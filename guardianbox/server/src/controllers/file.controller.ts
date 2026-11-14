import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { putEncryptedBlob, getEncryptedBlob, deleteEncryptedBlob } from '../services/storage.service';
import {
  createFile,
  getFileById,
  claimDownload,
  releaseDownload,
  deleteFileRecord,
} from '../models/file.model';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export async function uploadFile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { iv, salt, expiresIn, maxDownloads, originalName, mimeType } = req.body;

    if (!iv || !salt) {
      res.status(400).json({ error: 'Missing required fields: iv, salt' });
      return;
    }

    if (typeof iv !== 'string' || typeof salt !== 'string' || !B64_RE.test(iv) || !B64_RE.test(salt) || iv.length > 32 || salt.length > 64) {
      res.status(400).json({ error: 'Invalid iv or salt' });
      return;
    }

    const id = uuidv4();
    const s3Key = `uploads/${id}`;

    // Calculate expiration time
    let expiresAt: string | null = null;
    if (expiresIn) {
      const minutes = parseInt(expiresIn, 10);
      if (!isNaN(minutes) && minutes > 0) {
        const expDate = new Date(Date.now() + minutes * 60 * 1000);
        expiresAt = expDate.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
      }
    }

    let parsedMaxDownloads: number | null = maxDownloads ? parseInt(maxDownloads, 10) : null;
    if (parsedMaxDownloads !== null && (isNaN(parsedMaxDownloads) || parsedMaxDownloads < 1)) {
      parsedMaxDownloads = null;
    }

    // Upload encrypted buffer to object storage (S3 / MinIO)
    await putEncryptedBlob(s3Key, req.file.buffer, 'application/octet-stream');

    // Save record to DB
    createFile({
      id,
      original_name: originalName || req.file.originalname,
      mime_type: mimeType || req.file.mimetype,
      size: req.file.size,
      iv,
      salt,
      s3_key: s3Key,
      expires_at: expiresAt,
      max_downloads: parsedMaxDownloads,
    });

    res.status(201).json({
      id,
      expiresAt,
      maxDownloads: parsedMaxDownloads,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

export async function downloadFile(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    if (!UUID_RE.test(id)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const record = getFileById(id);

    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check if expired by time
    if (record.expires_at) {
      const expiresAt = new Date(record.expires_at + 'Z');
      if (expiresAt < new Date()) {
        res.status(410).json({ error: 'File has expired' });
        return;
      }
    }

    // Check if maxed out on downloads
    if (record.max_downloads !== null && record.download_count >= record.max_downloads) {
      res.status(410).json({ error: 'File has reached maximum download limit' });
      return;
    }

    // Atomically claim a download slot (prevents two parallel requests from both
    // passing the limit check).
    if (!claimDownload(id)) {
      res.status(410).json({ error: 'File has reached maximum download limit' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await getEncryptedBlob(record.s3_key);
    } catch (err) {
      releaseDownload(id); // don't burn a download if the blob could not be read
      throw err;
    }

    const reachedLimit = record.max_downloads !== null && record.download_count + 1 >= record.max_downloads;

    // Filenames may contain non-ASCII characters, which are illegal in HTTP headers,
    // so they are percent-encoded (the client decodes them).
    res.set({
      'Content-Type': 'application/octet-stream',
      'X-File-IV': record.iv,
      'X-File-Salt': record.salt,
      'X-Original-Name': encodeURIComponent(record.original_name),
      'X-Mime-Type': encodeURIComponent(record.mime_type),
      'Access-Control-Expose-Headers': 'X-File-IV, X-File-Salt, X-Original-Name, X-Mime-Type',
    });

    // Burn after reading: delete only after the response has been fully sent.
    if (reachedLimit) {
      res.on('finish', () => {
        deleteEncryptedBlob(record.s3_key)
          .then(() => deleteFileRecord(id))
          .catch((e) => console.error('Burn-after-read cleanup failed:', e));
      });
    }

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}

export async function getFileInfo(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    if (!UUID_RE.test(id)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const record = getFileById(id);

    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check if expired by time
    if (record.expires_at) {
      const expiresAt = new Date(record.expires_at + 'Z');
      if (expiresAt < new Date()) {
        res.status(410).json({ error: 'File has expired' });
        return;
      }
    }

    // Check if maxed out on downloads
    if (record.max_downloads !== null && record.download_count >= record.max_downloads) {
      res.status(410).json({ error: 'File has reached maximum download limit' });
      return;
    }

    res.json({
      id: record.id,
      originalName: record.original_name,
      mimeType: record.mime_type,
      size: record.size,
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
