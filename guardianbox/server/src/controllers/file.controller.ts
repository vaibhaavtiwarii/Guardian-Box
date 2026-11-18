import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  putEncryptedBlob,
  getEncryptedBlob,
  blobExists,
  deleteFileBlobs,
  ObjectNotFoundError,
} from '../services/storage.service';
import {
  createFile,
  markReady,
  getFileById,
  claimDownload,
  markDownloadFinished,
  deleteFileRecord,
  type FileRecord,
} from '../models/file.model';
import { createDownloadToken, verifyDownloadToken } from '../utils/downloadToken';
import { CHUNK_OVERHEAD, MAX_CHUNK_BYTES, MAX_UPLOAD_MB, MIN_CHUNK_BYTES } from '../middleware/upload';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function param(req: Request, name: string): string {
  const v = req.params[name];
  return (Array.isArray(v) ? v[0] : v) as string;
}

function isExpired(record: FileRecord): boolean {
  return !!record.expires_at && new Date(record.expires_at + 'Z') < new Date();
}

/** Parse a chunk index from the URL; returns null unless it is a valid index for this file. */
function parseIndex(raw: string, record: FileRecord): number | null {
  if (!/^\d{1,6}$/.test(raw)) return null;
  const index = Number(raw);
  return index < record.chunk_count ? index : null;
}

/** Bytes a stored chunk must have: plaintext length + IV + tag. */
function expectedChunkBytes(record: FileRecord, index: number): number {
  const plainTotal = record.size - CHUNK_OVERHEAD * record.chunk_count;
  const plain = index < record.chunk_count - 1 ? record.chunk_size : plainTotal - index * record.chunk_size;
  return plain + CHUNK_OVERHEAD;
}

function chunkKey(record: FileRecord, index: number): string {
  return `${record.s3_key}/${index}`;
}

/** Step 1 of an upload: describe the file and get an id. No file data is sent yet. */
export async function initUpload(req: Request, res: Response): Promise<void> {
  try {
    const { salt, originalName, mimeType, size, chunkSize, chunkCount, expiresIn, maxDownloads } = req.body ?? {};

    if (typeof salt !== 'string' || !B64_RE.test(salt) || salt.length > 64) {
      res.status(400).json({ error: 'Invalid salt' });
      return;
    }
    if (typeof originalName !== 'string' || originalName.length < 1 || originalName.length > 255) {
      res.status(400).json({ error: 'Invalid file name' });
      return;
    }
    const mime = typeof mimeType === 'string' && mimeType.length <= 255 ? mimeType : 'application/octet-stream';

    if (!Number.isInteger(size) || size < 0 || !Number.isInteger(chunkSize) || !Number.isInteger(chunkCount)) {
      res.status(400).json({ error: 'Invalid size or chunk description' });
      return;
    }
    if (size > MAX_UPLOAD_MB * 1024 * 1024) {
      res.status(413).json({ error: `File too large (max ${MAX_UPLOAD_MB} MB)` });
      return;
    }
    if (chunkSize < MIN_CHUNK_BYTES || chunkSize > MAX_CHUNK_BYTES || chunkCount !== Math.max(1, Math.ceil(size / chunkSize))) {
      res.status(400).json({ error: 'Chunk count does not match the file size' });
      return;
    }

    // `expiresIn` is a number of SECONDS.
    let expiresAt: string | null = null;
    const seconds = parseInt(String(expiresIn ?? ''), 10);
    if (!isNaN(seconds) && seconds > 0) {
      expiresAt = new Date(Date.now() + seconds * 1000).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }

    let limit: number | null = parseInt(String(maxDownloads ?? ''), 10);
    if (isNaN(limit) || limit < 1) limit = null;

    const id = uuidv4();
    await createFile({
      id,
      original_name: originalName,
      mime_type: mime,
      size: size + CHUNK_OVERHEAD * chunkCount,
      salt,
      s3_key: `uploads/${id}`,
      expires_at: expiresAt,
      max_downloads: limit,
      chunk_count: chunkCount,
      chunk_size: chunkSize,
    });

    res.status(201).json({ id, expiresAt, maxDownloads: limit });
  } catch (error) {
    console.error('Init upload error:', error);
    res.status(500).json({ error: 'Failed to start upload' });
  }
}

/** Step 2: store one encrypted chunk. Only one chunk is ever held in memory. */
export async function uploadChunk(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req, 'id');
    const record = UUID_RE.test(id) ? await getFileById(id) : undefined;
    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (record.status !== 'pending') {
      res.status(409).json({ error: 'This upload is already complete' });
      return;
    }
    const index = parseIndex(param(req, 'index'), record);
    if (index === null) {
      res.status(400).json({ error: 'Invalid chunk index' });
      return;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body)) {
      res.status(415).json({ error: 'Send the chunk as application/octet-stream' });
      return;
    }
    if (body.length !== expectedChunkBytes(record, index)) {
      res.status(400).json({ error: 'Chunk has the wrong size' });
      return;
    }

    await putEncryptedBlob(chunkKey(record, index), body, 'application/octet-stream');
    res.status(204).end();
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: 'Failed to store chunk' });
  }
}

/** Step 3: check that every chunk arrived, then make the link usable. */
export async function completeUpload(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req, 'id');
    const record = UUID_RE.test(id) ? await getFileById(id) : undefined;
    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (record.status === 'pending') {
      for (let i = 0; i < record.chunk_count; i++) {
        if (!(await blobExists(chunkKey(record, i)))) {
          res.status(400).json({ error: `Chunk ${i} is missing`, missing: i });
          return;
        }
      }
      await markReady(id);
    }
    res.json({ id, expiresAt: record.expires_at, maxDownloads: record.max_downloads });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(500).json({ error: 'Failed to complete upload' });
  }
}

/** Public details of a link. Reading them does not use up a download. */
export async function getFileInfo(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req, 'id');
    const record = UUID_RE.test(id) ? await getFileById(id) : undefined;
    if (!record || record.status !== 'ready') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (isExpired(record)) {
      res.status(410).json({ error: 'File has expired' });
      return;
    }
    if (record.max_downloads !== null && record.download_count >= record.max_downloads) {
      res.status(410).json({ error: 'File has reached maximum download limit' });
      return;
    }

    res.json({
      id: record.id,
      originalName: record.original_name,
      mimeType: record.mime_type,
      size: record.size,
      chunkCount: record.chunk_count,
      expiresAt: record.expires_at,
      maxDownloads: record.max_downloads,
      downloadCount: record.download_count,
      createdAt: record.created_at,
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
}

/**
 * Claim one download (this is what counts toward the limit) and return what the browser
 * needs to fetch and decrypt the chunks. Claiming is atomic, so parallel requests cannot
 * exceed the limit.
 */
export async function startDownload(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req, 'id');
    const record = UUID_RE.test(id) ? await getFileById(id) : undefined;
    if (!record || record.status !== 'ready') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (isExpired(record)) {
      res.status(410).json({ error: 'File has expired' });
      return;
    }
    if (!(await claimDownload(id))) {
      res.status(410).json({ error: 'File has reached maximum download limit' });
      return;
    }

    res.json({
      token: createDownloadToken(id),
      salt: record.salt,
      chunkCount: record.chunk_count,
      chunkSize: record.chunk_size,
      originalName: record.original_name,
      mimeType: record.mime_type,
      size: record.size,
    });
  } catch (error) {
    console.error('Start download error:', error);
    res.status(500).json({ error: 'Failed to start download' });
  }
}

/** Send one encrypted chunk. Needs the token from startDownload. */
export async function downloadChunk(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req, 'id');
    if (!UUID_RE.test(id)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (!verifyDownloadToken(id, req.get('x-download-token'))) {
      res.status(401).json({ error: 'Start the download first' });
      return;
    }
    const record = await getFileById(id);
    if (!record || record.status !== 'ready') {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (isExpired(record)) {
      res.status(410).json({ error: 'File has expired' });
      return;
    }
    const index = parseIndex(param(req, 'index'), record);
    if (index === null) {
      res.status(400).json({ error: 'Invalid chunk index' });
      return;
    }

    let data: Buffer;
    try {
      data = await getEncryptedBlob(chunkKey(record, index));
    } catch (err) {
      // A chunk is gone from storage (deleted outside the app): the link can never work again.
      if (err instanceof ObjectNotFoundError) {
        await deleteFileBlobs(record.s3_key, record.chunk_count).catch(() => undefined);
        await deleteFileRecord(id);
        res.status(404).json({ error: 'File not found' });
        return;
      }
      throw err;
    }

    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(data.length) });

    // Burn after reading: once the last chunk of the last allowed download has been fully
    // sent, delete every chunk and the record.
    if (index === record.chunk_count - 1) {
      res.on('finish', () => {
        markDownloadFinished(id)
          .then(async (finished) => {
            if (record.max_downloads !== null && finished >= record.max_downloads) {
              await deleteFileBlobs(record.s3_key, record.chunk_count);
              await deleteFileRecord(id);
            }
          })
          .catch((e) => console.error('Burn-after-read cleanup failed:', e));
      });
    }

    res.send(data);
  } catch (error) {
    console.error('Chunk download error:', error);
    res.status(500).json({ error: 'Failed to download chunk' });
  }
}
