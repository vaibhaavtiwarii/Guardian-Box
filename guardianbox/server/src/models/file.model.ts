import db from '../config/db';
import type { Row } from '@libsql/client';

export interface FileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  iv: string;
  salt: string;
  s3_key: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
}

function toRecord(row: Row): FileRecord {
  return {
    id: String(row.id),
    original_name: String(row.original_name),
    mime_type: String(row.mime_type),
    size: Number(row.size),
    iv: String(row.iv),
    salt: String(row.salt),
    s3_key: String(row.s3_key),
    expires_at: row.expires_at === null || row.expires_at === undefined ? null : String(row.expires_at),
    max_downloads: row.max_downloads === null || row.max_downloads === undefined ? null : Number(row.max_downloads),
    download_count: Number(row.download_count ?? 0),
    created_at: String(row.created_at),
  };
}

export async function createFile(record: Omit<FileRecord, 'download_count' | 'created_at'>): Promise<void> {
  await db.execute({
    sql: `INSERT INTO files (id, original_name, mime_type, size, iv, salt, s3_key, expires_at, max_downloads)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      record.id,
      record.original_name,
      record.mime_type,
      record.size,
      record.iv,
      record.salt,
      record.s3_key,
      record.expires_at,
      record.max_downloads,
    ],
  });
}

export async function getFileById(id: string): Promise<FileRecord | undefined> {
  const result = await db.execute({ sql: 'SELECT * FROM files WHERE id = ?', args: [id] });
  return result.rows.length ? toRecord(result.rows[0]) : undefined;
}

/**
 * Atomically claim one download slot. Returns false if the file has already
 * reached its download limit (prevents the burn-after-reading race).
 */
export async function claimDownload(id: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'UPDATE files SET download_count = download_count + 1 WHERE id = ? AND (max_downloads IS NULL OR download_count < max_downloads)',
    args: [id],
  });
  return result.rowsAffected > 0;
}

export async function releaseDownload(id: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE files SET download_count = download_count - 1 WHERE id = ? AND download_count > 0',
    args: [id],
  });
}

export async function getExpiredFiles(): Promise<FileRecord[]> {
  const result = await db.execute(
    "SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  );
  return result.rows.map(toRecord);
}

export async function getMaxedOutFiles(): Promise<FileRecord[]> {
  const result = await db.execute(
    'SELECT * FROM files WHERE max_downloads IS NOT NULL AND download_count >= max_downloads'
  );
  return result.rows.map(toRecord);
}

export async function deleteFileRecord(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM files WHERE id = ?', args: [id] });
}
