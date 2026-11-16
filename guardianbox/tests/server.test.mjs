// Integration tests for the server: expiry, burn-after-read and input validation.
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
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(root, 'server', 'dist', 'index.js');
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const tmp = mkdtempSync(path.join(tmpdir(), 'guardianbox-test-'));
const storageDir = path.join(tmp, 'blobs');

let server;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const countBlobs = () => {
  const dir = path.join(storageDir, 'uploads');
  return existsSync(dir) ? readdirSync(dir).length : 0;
};

async function upload({ expiresIn, maxDownloads, iv = 'AAAAAAAAAAAAAAAA', salt = 'AAAAAAAAAAAAAAAAAAAAAA==' } = {}) {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('not-really-encrypted-but-opaque-bytes')]), 'x.bin');
  form.append('iv', iv);
  form.append('salt', salt);
  form.append('originalName', 'secret.txt');
  form.append('mimeType', 'text/plain');
  if (expiresIn !== undefined) form.append('expiresIn', String(expiresIn));
  if (maxDownloads !== undefined) form.append('maxDownloads', String(maxDownloads));
  return fetch(`${base}/api/files/upload`, { method: 'POST', body: form });
}

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

test('upload stores a blob and returns its id', async () => {
  const res = await upload();
  assert.equal(res.status, 201);
  const { id } = await res.json();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.ok(countBlobs() >= 1);
});

test('download returns the stored bytes with iv and salt headers', async () => {
  const { id } = await (await upload()).json();
  const res = await fetch(`${base}/api/files/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-file-iv'), 'AAAAAAAAAAAAAAAA');
  assert.equal(res.headers.get('x-file-salt'), 'AAAAAAAAAAAAAAAAAAAAAA==');
  assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'not-really-encrypted-but-opaque-bytes');
});

test('expiresIn is in seconds: 3600 means one hour, not 60 hours', async () => {
  const before = Date.now();
  const { id } = await (await upload({ expiresIn: 3600 })).json();
  const info = await (await fetch(`${base}/api/files/${id}/info`)).json();
  const expires = new Date(info.expiresAt.replace(' ', 'T') + 'Z').getTime();
  const seconds = (expires - before) / 1000;
  assert.ok(seconds > 3590 && seconds < 3610, `expected about 3600s, got ${seconds}`);
});

test('an expired file returns 410 on info and download', async () => {
  const { id } = await (await upload({ expiresIn: 1 })).json();
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 200);
  await sleep(2500);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 410);
  assert.equal((await fetch(`${base}/api/files/${id}`)).status, 410);
});

test('burn after reading: the last allowed download deletes the file', async () => {
  const { id } = await (await upload({ maxDownloads: 2 })).json();
  const blobsBefore = countBlobs();

  assert.equal((await (await fetch(`${base}/api/files/${id}`)).arrayBuffer()).byteLength > 0, true);
  const info = await (await fetch(`${base}/api/files/${id}/info`)).json();
  assert.equal(info.downloadCount, 1);

  assert.equal((await fetch(`${base}/api/files/${id}`)).status, 200); // 2nd and last
  await sleep(500); // deletion happens right after the response finishes
  const after = (await fetch(`${base}/api/files/${id}`)).status;
  assert.ok(after === 404 || after === 410, `expected 404 or 410, got ${after}`);
  assert.equal(countBlobs(), blobsBefore - 1, 'the encrypted blob should be deleted from storage');
});

test('parallel downloads cannot exceed the limit', async () => {
  const { id } = await (await upload({ maxDownloads: 1 })).json();
  const results = await Promise.all(Array.from({ length: 8 }, () => fetch(`${base}/api/files/${id}`)));
  const ok = results.filter((r) => r.status === 200).length;
  assert.equal(ok, 1, 'exactly one request may receive the file');
  for (const r of results) await r.arrayBuffer().catch(() => {});
});

test('unknown and malformed ids return 404', async () => {
  assert.equal((await fetch(`${base}/api/files/00000000-0000-4000-8000-000000000000`)).status, 404);
  assert.equal((await fetch(`${base}/api/files/not-a-uuid`)).status, 404);
});

test('upload rejects missing or invalid iv and salt', async () => {
  assert.equal((await upload({ iv: '' })).status, 400);
  assert.equal((await upload({ iv: 'not base64!!' })).status, 400);
  assert.equal((await upload({ salt: '<script>' })).status, 400);
});

test('the database record never contains a key or plaintext', async () => {
  const { id } = await (await upload()).json();
  const info = await (await fetch(`${base}/api/files/${id}/info`)).json();
  assert.deepEqual(Object.keys(info).sort(), [
    'createdAt', 'downloadCount', 'expiresAt', 'id', 'maxDownloads', 'mimeType', 'originalName', 'size',
  ]);
});

test('a blob deleted from storage turns the link into a 404 and removes the record', async () => {
  const { id } = await (await upload()).json();
  rmSync(path.join(storageDir, 'uploads', id));
  assert.equal((await fetch(`${base}/api/files/${id}`)).status, 404);
  assert.equal((await fetch(`${base}/api/files/${id}/info`)).status, 404);
});
