// Integration tests for the server: chunked upload and download, expiry, burn-after-read
// and input validation.
// They start the built server (server/dist) on a random port with a temporary
// database and local blob storage, then talk to it over HTTP.
//
// Run `npm run build:server` first, then `npm test` from guardianbox/.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  CHUNK_OVERHEAD,
  decryptChunk,
  deriveKey,
  encryptChunk,
  generateSalt,
  arrayBufferToBase64,
} from '../client/src/utils/cryptoUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(root, 'server', 'dist', 'index.js');
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const tmp = mkdtempSync(path.join(tmpdir(), 'guardianbox-test-'));
const storageDir = path.join(tmp, 'blobs');

let server;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let serverLog = '';
let serverExited = null;

before(async () => {
  assert.ok(existsSync(serverEntry), 'Run `npm run build:server` before the server tests.');
  server = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(tmp, 'test.db'),
      STORAGE_MODE: 'local',
      LOCAL_STORAGE_DIR: storageDir,
      S3_STRICT: 'false',
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      RATE_LIMIT_PER_MIN: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  server.on('exit', (code) => (serverExited = code));

  for (let i = 0; i < 60; i++) {
    if (serverExited !== null) {
      throw new Error(`Server exited early with code ${serverExited}. Server output:\n${serverLog}`);
    }
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Server did not start within 15 seconds. Server output:\n' + serverLog);
}, { timeout: 30000 });

after(async () => {
  if (server) {
    server.stdout?.destroy();
    server.stderr?.destroy();
    server.kill('SIGKILL');
    await sleep(500);
    server.unref();
  }
  try {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Windows may still hold the database file; the OS cleans the temp folder later.
  }
});

const CHUNK = 64 * 1024; // smallest chunk size the server accepts; keeps the tests fast
const SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';
const chunkCountFor = (size, chunkSize = CHUNK) => Math.max(1, Math.ceil(size / chunkSize));
const json = (res) => res.json();

const storedChunks = (id) => {
  const dir = path.join(storageDir, 'uploads', id);
  return existsSync(dir) ? readdirSync(dir).length : 0;
};

/** Step 1: describe the file. Returns the raw response. */
function init(fields = {}) {
  const size = fields.size ?? 150 * 1024;
  return fetch(`${base}/api/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      salt: SALT,
      originalName: 'secret.txt',
      mimeType: 'text/plain',
      size,
      chunkSize: CHUNK,
      chunkCount: chunkCountFor(size),
      ...fields,
    }),
  });
}

const putChunk = (id, index, bytes) =>
  fetch(`${base}/api/files/${id}/chunks/${index}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });

const complete = (id) => fetch(`${base}/api/files/${id}/complete`, { method: 'POST' });

/** The byte length the server expects for chunk `index` of a file of `size` bytes. */
function chunkLength(size, index) {
  const count = chunkCountFor(size);
  return (index < count - 1 ? CHUNK : size - index * CHUNK) + CHUNK_OVERHEAD;
}

/** init + upload random bytes of the right sizes + complete. Returns the file id. */
async function share({ size = 150 * 1024, ...rest } = {}) {
  const res = await init({ size, ...rest });
  assert.equal(res.status, 201);
  const { id } = await json(res);
  for (let i = 0; i < chunkCountFor(size); i++) {
    assert.equal((await putChunk(id, i, randomBytes(chunkLength(size, i)))).status, 204);
  }
  assert.equal((await complete(id)).status, 200);
  return id;
}

const startDownload = (id) => fetch(`${base}/api/files/${id}/download`, { method: 'POST' });
const getChunk = (id, index, token) =>
  fetch(`${base}/api/files/${id}/chunks/${index}`, { headers: token ? { 'X-Download-Token': token } : {} });

/** Claim a download and fetch every chunk. Returns the chunks as Uint8Arrays. */
async function downloadAll(id) {
  const start = await startDownload(id);
  assert.equal(start.status, 200);
  const session = await json(start);
  const chunks = [];
  for (let i = 0; i < session.chunkCount; i++) {
    const res = await getChunk(id, i, session.token);
    assert.equal(res.status, 200);
    chunks.push(new Uint8Array(await res.arrayBuffer()));
  }
  return { session, chunks };
}


test('init rejects a bad salt, a wrong chunk count and files over the size limit', async () => {
  assert.equal((await init({ salt: '<script>' })).status, 400);
  assert.equal((await init({ salt: '' })).status, 400);
  assert.equal((await init({ chunkCount: 99 })).status, 400);
  assert.equal((await init({ chunkSize: 10 })).status, 400);
  assert.equal((await init({ originalName: '' })).status, 400);
  const huge = 501 * 1024 * 1024;
  assert.equal((await init({ size: huge, chunkCount: chunkCountFor(huge) })).status, 413);
});

test('a multi-chunk file round-trips with real encryption, and a wrong key is rejected on chunk 0', async () => {
  const plaintext = randomBytes(150 * 1024 + 123); // 3 chunks of 64 KiB
  const salt = generateSalt();
  const key = await deriveKey('a good key', salt);
  const count = chunkCountFor(plaintext.length);

  const { id } = await json(
    await init({ size: plaintext.length, chunkCount: count, salt: arrayBufferToBase64(salt) })
  );
  for (let i = 0; i < count; i++) {
    const part = plaintext.subarray(i * CHUNK, Math.min(plaintext.length, (i + 1) * CHUNK));
    const encrypted = await encryptChunk(key, part.buffer.slice(part.byteOffset, part.byteOffset + part.length), i, i === count - 1);
    assert.equal((await putChunk(id, i, encrypted)).status, 204);
  }
  assert.equal((await complete(id)).status, 200);
  assert.equal(storedChunks(id), count);

  const { chunks } = await downloadAll(id);
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    out.push(Buffer.from(await decryptChunk(key, chunks[i], i, i === chunks.length - 1)));
  }
  assert.ok(Buffer.concat(out).equals(plaintext), 'decrypted bytes must equal the original');
  // the stored bytes never contain the plaintext
  assert.equal(Buffer.concat(chunks.map((c) => Buffer.from(c))).includes(plaintext.subarray(0, 64)), false);

  const wrong = await deriveKey('a bad key', salt);
  await assert.rejects(decryptChunk(wrong, chunks[0], 0, false));
});

test('chunks that are reordered or truncated by the server fail to decrypt', async () => {
  const key = await deriveKey('k', generateSalt());
  const c0 = await encryptChunk(key, new Uint8Array(100).buffer, 0, false);
  const c1 = await encryptChunk(key, new Uint8Array(100).buffer, 1, true);
  await assert.rejects(decryptChunk(key, c1, 0, false)); // swapped
  await assert.rejects(decryptChunk(key, c0, 0, true)); // last chunk dropped, this one looks final
});

test('a file is not downloadable until the upload is complete', async () => {
  const size = 150 * 1024;
  const { id } = await json(await init({ size }));
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 404);
  assert.equal((await startDownload(id)).status, 404);

  assert.equal((await putChunk(id, 0, randomBytes(chunkLength(size, 0)))).status, 204);
  const missing = await complete(id);
  assert.equal(missing.status, 400);
  assert.equal((await json(missing)).missing, 1);
});

test('chunk uploads are validated: size, index and finished uploads', async () => {
  const size = 150 * 1024;
  const { id } = await json(await init({ size }));
  assert.equal((await putChunk(id, 0, randomBytes(100))).status, 400); // wrong length
  assert.equal((await putChunk(id, 9, randomBytes(CHUNK + CHUNK_OVERHEAD))).status, 400); // out of range
  assert.equal((await putChunk(id, 'x', randomBytes(10))).status, 400); // not a number
  assert.equal((await putChunk('00000000-0000-4000-8000-000000000000', 0, randomBytes(10))).status, 404);

  for (let i = 0; i < chunkCountFor(size); i++) await putChunk(id, i, randomBytes(chunkLength(size, i)));
  assert.equal((await complete(id)).status, 200);
  assert.equal((await complete(id)).status, 200); // completing twice is harmless
  assert.equal((await putChunk(id, 0, randomBytes(chunkLength(size, 0)))).status, 409);
});

test('info shows metadata only and does not use up a download', async () => {
  const id = await share({ maxDownloads: 1 });
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${base}/api/files/${id}/info`);
    assert.equal(res.status, 200);
    const info = await json(res);
    assert.equal(info.downloadCount, 0);
    assert.deepEqual(Object.keys(info).sort(), [
      'chunkCount', 'createdAt', 'downloadCount', 'expiresAt', 'id', 'maxDownloads', 'mimeType', 'originalName', 'size',
    ]);
  }
});

test('expiresIn is in seconds: 3600 means one hour, not 60 hours', async () => {
  const before = Date.now();
  const id = await share({ expiresIn: 3600 });
  const info = await json(await fetch(`${base}/api/files/${id}/info`));
  const expires = new Date(info.expiresAt.replace(' ', 'T') + 'Z').getTime();
  const seconds = (expires - before) / 1000;
  assert.ok(seconds > 3590 && seconds < 3610, `expected about 3600s, got ${seconds}`);
});

test('an expired file returns 410 on info, download start and chunks', async () => {
  const id = await share({ expiresIn: 2 });
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 200);
  const session = await json(await startDownload(id));
  await sleep(3200);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 410);
  assert.equal((await startDownload(id)).status, 410);
  assert.equal((await getChunk(id, 0, session.token)).status, 410);
});

test('chunks need a valid download token for that file', async () => {
  const a = await share();
  const b = await share();
  const session = await json(await startDownload(a));
  assert.equal((await getChunk(a, 0)).status, 401); // no token
  assert.equal((await getChunk(a, 0, 'garbage')).status, 401);
  assert.equal((await getChunk(b, 0, session.token)).status, 401); // token of another file
  assert.equal((await getChunk(a, 0, session.token + 'x')).status, 401); // tampered
  assert.equal((await getChunk(a, 0, session.token)).status, 200);
  assert.equal((await getChunk(a, 99, session.token)).status, 400);
});

test('burn after reading: the last finished download deletes every chunk', async () => {
  const id = await share({ maxDownloads: 2 });
  assert.ok(storedChunks(id) >= 3);

  await downloadAll(id);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 200);
  assert.equal(storedChunks(id), chunkCountFor(150 * 1024), 'still stored after the first download');

  await downloadAll(id); // second and last allowed download
  await sleep(600); // deletion happens right after the last response finishes
  assert.equal(storedChunks(id), 0, 'all chunks should be deleted from storage');

  const info = (await fetch(`${base}/api/files/${id}/info`)).status;
  assert.ok(info === 404 || info === 410, `expected 404 or 410, got ${info}`);
  const start = (await startDownload(id)).status;
  assert.ok(start === 404 || start === 410, `expected 404 or 410, got ${start}`);
});

test('two overlapping downloads: the file survives until both have finished', async () => {
  const id = await share({ maxDownloads: 2 });
  const first = await json(await startDownload(id));
  const second = await json(await startDownload(id)); // limit is now used up
  assert.equal((await startDownload(id)).status, 410);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 410);

  for (let i = 0; i < second.chunkCount; i++) assert.equal((await getChunk(id, i, second.token)).status, 200);
  await sleep(600);
  assert.ok(storedChunks(id) > 0, 'the first recipient has not finished yet');

  for (let i = 0; i < first.chunkCount; i++) assert.equal((await getChunk(id, i, first.token)).status, 200);
  await sleep(600);
  assert.equal(storedChunks(id), 0);
});

test('parallel download starts cannot exceed the limit', async () => {
  const id = await share({ maxDownloads: 1 });
  const results = await Promise.all(Array.from({ length: 8 }, () => startDownload(id)));
  assert.equal(results.filter((r) => r.status === 200).length, 1, 'exactly one request may get a session');
  for (const r of results) await r.arrayBuffer().catch(() => {});
});

test('unknown and malformed ids return 404', async () => {
  const unknown = '00000000-0000-4000-8000-000000000000';
  assert.equal((await fetch(`${base}/api/files/${unknown}/info`)).status, 404);
  assert.equal((await startDownload(unknown)).status, 404);
  assert.equal((await fetch(`${base}/api/files/not-a-uuid/info`)).status, 404);
  assert.equal((await startDownload('not-a-uuid')).status, 404);
  assert.equal((await getChunk('not-a-uuid', 0, 'x')).status, 404);
});

test('a chunk deleted from storage turns the link into a 404 and removes the record', async () => {
  const id = await share();
  const session = await json(await startDownload(id));
  rmSync(path.join(storageDir, 'uploads', id, '1'));
  assert.equal((await getChunk(id, 0, session.token)).status, 200);
  assert.equal((await getChunk(id, 1, session.token)).status, 404);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 404);
  assert.equal(storedChunks(id), 0, 'the remaining chunks are removed too');
});
