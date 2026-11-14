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
      iv TEXT NOT NULL,
      salt TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      expires_at TEXT,
      max_downloads INTEGER,
      download_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log(
    process.env.TURSO_DATABASE_URL
      ? '[DB] Connected to hosted libSQL (Turso) database.'
      : '[DB] Using local SQLite file database.'
  );
}

export default db;
