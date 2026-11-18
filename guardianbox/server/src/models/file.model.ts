import db from '../config/db';
import type { Row } from '@libsql/client';

export interface FileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  /** Total bytes stored on the server (all chunks, including IV and tag overhead). */
  size: number;
  salt: string;
  /** Prefix of the chunk objects: chunk i lives at `${s3_key}/${i}`. */
  s3_key: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
  chunk_count: number;
  /** Plaintext bytes per chunk (the last chunk may be smaller). */
  chunk_size: number;
  /** 'pending' while chunks are still being uploaded, then 'ready'. */
  status: 'pending' | 'ready';
  finished_count: number;
}

function toRecord(row: Row): FileRecord {
  return {
    id: String(row.id),
    original_name: String(row.original_name),
    mime_type: String(row.mime_type),
    size: Number(row.size),
    salt: String(row.salt),
    s3_key: String(row.s3_key),
    expires_at: row.expires_at === null || row.expires_at === undefined ? null : String(row.expires_at),
    max_downloads: row.max_downloads === null || row.max_downloads === undefined ? null : Number(row.max_downloads),
    download_count: Number(row.download_count ?? 0),
    created_at: String(row.created_at),
    chunk_count: Number(row.chunk_count ?? 1),
    chunk_size: Number(row.chunk_size ?? 0),
    status: row.status === 'pending' ? 'pending' : 'ready',
    finished_count: Number(row.finished_count ?? 0),
  };
}

export type NewFile = Pick<
  FileRecord,
  'id' | 'original_name' | 'mime_type' | 'size' | 'salt' | 's3_key' | 'expires_at' | 'max_downloads' | 'chunk_count' | 'chunk_size'
>;

/** Create the record in the 'pending' state; it becomes downloadable once markReady() is called. */
export async function createFile(record: NewFile): Promise<void> {
  await db.execute({
    sql: `INSERT INTO files (id, original_name, mime_type, size, iv, salt, s3_key, expires_at, max_downloads, chunk_count, chunk_size, status)
          VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'pending')`,
    args: [
      record.id,
      record.original_name,
      record.mime_type,
      record.size,
      record.salt,
      record.s3_key,
      record.expires_at,
      record.max_downloads,
      record.chunk_count,
      record.chunk_size,
    ],
  });
}

export async function markReady(id: string): Promise<void> {
  await db.execute({ sql: "UPDATE files SET status = 'ready' WHERE id = ?", args: [id] });
}

export async function getFileById(id: string): Promise<FileRecord | undefined> {
  const result = await db.execute({ sql: 'SELECT * FROM files WHERE id = ?', args: [id] });
  return result.rows.length ? toRecord(result.rows[0]) : undefined;
}

/**
 * Atomically claim one download slot. Returns false if the file is not ready or has
 * already reached its download limit (prevents the burn-after-reading race).
 */
export async function claimDownload(id: string): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE files SET download_count = download_count + 1, claimed_at = datetime('now')
          WHERE id = ? AND status = 'ready' AND (max_downloads IS NULL OR download_count < max_downloads)`,
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

/** Record that a recipient received the last chunk. Returns how many downloads have now finished. */
export async function markDownloadFinished(id: string): Promise<number> {
  await db.execute({ sql: 'UPDATE files SET finished_count = finished_count + 1 WHERE id = ?', args: [id] });
  const result = await db.execute({ sql: 'SELECT finished_count FROM files WHERE id = ?', args: [id] });
  return result.rows.length ? Number(result.rows[0].finished_count) : 0;
}

export async function getExpiredFiles(): Promise<FileRecord[]> {
  const result = await db.execute(
    "SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  );
  return result.rows.map(toRecord);
}

/**
 * Files whose download limit is used up. A download that is still in progress gets a grace
 * period (the download token lifetime) before its chunks are removed by the cleanup job.
 */
export async function getMaxedOutFiles(graceMinutes: number): Promise<FileRecord[]> {
  const result = await db.execute({
    sql: `SELECT * FROM files
          WHERE max_downloads IS NOT NULL AND download_count >= max_downloads
            AND (claimed_at IS NULL OR claimed_at < datetime('now', ?))`,
    args: [`-${graceMinutes} minutes`],
  });
  return result.rows.map(toRecord);
}

/** Uploads that were started but never completed. */
export async function getStalePendingFiles(olderThanMinutes: number): Promise<FileRecord[]> {
  const result = await db.execute({
    sql: "SELECT * FROM files WHERE status = 'pending' AND created_at < datetime('now', ?)",
    args: [`-${olderThanMinutes} minutes`],
  });
  return result.rows.map(toRecord);
}

export async function deleteFileRecord(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM files WHERE id = ?', args: [id] });
}
