import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

/**
 * Metadata database.
 *  - Production: a hosted Turso (libSQL / SQLite-compatible) database via
 *    TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, so metadata survives restarts on hosts
 *    with an ephemeral filesystem.
 *  - Local development: a plain SQLite file (server/data/guardianbox.db, or DB_PATH).
 */
function resolveUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'guardianbox.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return pathToFileURL(path.resolve(dbPath)).href;
}

const db = createClient({
  url: resolveUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export async function initDb(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      iv TEXT NOT NULL DEFAULT '',
      salt TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      expires_at TEXT,
      max_downloads INTEGER,
      download_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      chunk_count INTEGER NOT NULL DEFAULT 1,
      chunk_size INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ready',
      claimed_at TEXT,
      finished_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Databases created by an older version lack the chunk columns: add them in place.
  const existing = await db.execute('PRAGMA table_info(files)');
  const have = new Set(existing.rows.map((r) => String(r.name)));
  const migrations: Array<[string, string]> = [
    ['chunk_count', 'ALTER TABLE files ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 1'],
    ['chunk_size', 'ALTER TABLE files ADD COLUMN chunk_size INTEGER NOT NULL DEFAULT 0'],
    ['status', "ALTER TABLE files ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'"],
    ['claimed_at', 'ALTER TABLE files ADD COLUMN claimed_at TEXT'],
    ['finished_count', 'ALTER TABLE files ADD COLUMN finished_count INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [column, sql] of migrations) {
    if (!have.has(column)) await db.execute(sql);
  }

  console.log(
    process.env.TURSO_DATABASE_URL
      ? '[DB] Connected to hosted libSQL (Turso) database.'
      : '[DB] Using local SQLite file database.'
  );
}

export default db;
