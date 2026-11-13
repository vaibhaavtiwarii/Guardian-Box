import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { putEncryptedBlob, getEncryptedBlob, deleteEncryptedBlob } from '../services/storage.service';
import {
  createFile,
  getFileById,
  incrementDownloadCount,
  deleteFileRecord,
} from '../models/file.model';

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

    const parsedMaxDownloads = maxDownloads ? parseInt(maxDownloads, 10) : null;

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

    // Fetch encrypted blob from storage
    const buffer = await getEncryptedBlob(record.s3_key);

    // Increment download count
    incrementDownloadCount(id);

    // Check if this download maxes it out — if so, clean up
    const newCount = record.download_count + 1;
    if (record.max_downloads !== null && newCount >= record.max_downloads) {
      // Delete from storage and DB
      await deleteEncryptedBlob(record.s3_key);
      deleteFileRecord(id);
    }

    // Return the blob with appropriate headers
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${record.original_name}"`,
      'X-File-IV': record.iv,
      'X-File-Salt': record.salt,
      'X-Original-Name': record.original_name,
      'X-Mime-Type': record.mime_type,
      'Access-Control-Expose-Headers': 'X-File-IV, X-File-Salt, X-Original-Name, X-Mime-Type',
    });

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}

export async function getFileInfo(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
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
