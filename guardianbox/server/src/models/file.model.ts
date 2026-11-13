import db from '../config/db';

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

export function createFile(record: Omit<FileRecord, 'download_count' | 'created_at'>): void {
  const stmt = db.prepare(`
    INSERT INTO files (id, original_name, mime_type, size, iv, salt, s3_key, expires_at, max_downloads)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.id,
    record.original_name,
    record.mime_type,
    record.size,
    record.iv,
    record.salt,
    record.s3_key,
    record.expires_at,
    record.max_downloads
  );
}

export function getFileById(id: string): FileRecord | undefined {
  const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
  return stmt.get(id) as unknown as FileRecord | undefined;
}

export function incrementDownloadCount(id: string): void {
  const stmt = db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?');
  stmt.run(id);
}

export function getExpiredFiles(): FileRecord[] {
  const stmt = db.prepare("SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < datetime('now')");
  return stmt.all() as unknown as FileRecord[];
}

export function getMaxedOutFiles(): FileRecord[] {
  const stmt = db.prepare('SELECT * FROM files WHERE max_downloads IS NOT NULL AND download_count >= max_downloads');
  return stmt.all() as unknown as FileRecord[];
}

export function deleteFileRecord(id: string): void {
  const stmt = db.prepare('DELETE FROM files WHERE id = ?');
  stmt.run(id);
}
