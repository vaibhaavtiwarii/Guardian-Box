import {
  CHUNK_SIZE,
  chunkCountFor,
  decryptChunk,
  deriveKey,
  encryptChunk,
  generateSalt,
  arrayBufferToBase64,
  base64ToUint8Array,
} from './cryptoUtils';
import type { FileUploadResponse } from '../types';

/** The link is dead for good (expired, used up or deleted); retrying cannot help. */
export class LinkGoneError extends Error {}

export type ProgressCallback = (done: number, total: number) => void;

/** How many chunks are in flight at once. Hides per-request latency; memory use stays at a few chunks. */
const CONCURRENCY = 4;

/** Run `worker(i)` for i in [from, to) with at most `limit` running at once. Stops at the first error. */
async function runPool(from: number, to: number, limit: number, worker: (i: number) => Promise<void>): Promise<void> {
  let next = from;
  let failed = false;
  const lane = async () => {
    while (!failed) {
      const i = next++;
      if (i >= to) return;
      try {
        await worker(i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, to - from)) }, lane));
}

/** Milliseconds the server spent talking to object storage, from the Server-Timing header. */
function storageMs(res: Response): number {
  const m = /storage;dur=(\d+)/.exec(res.headers.get('Server-Timing') || '');
  return m ? Number(m[1]) : 0;
}

function logStats(kind: string, chunks: number, started: number, storageTotal: number) {
  const seconds = (performance.now() - started) / 1000;
  console.info(
    `[GuardianBox] ${kind}: ${chunks} chunk(s) in ${seconds.toFixed(1)}s, ` +
      `server storage time ${(storageTotal / 1000).toFixed(1)}s in total (${CONCURRENCY} at a time)`
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch with a few retries for network drops and 5xx answers (used for idempotent requests). */
async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || attempt === retries) return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
    }
    await sleep(400 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error('Network error. Check your connection and try again.');
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    /* not JSON */
  }
  return `${fallback} (${res.status})`;
}

/**
 * Encrypt a file in the browser, one chunk at a time, and upload each chunk as it is
 * ready. Neither the browser nor the server ever holds the whole file in memory.
 */
export async function uploadFile(
  file: File,
  password: string,
  options: { expiresIn?: number; maxDownloads?: number } = {},
  onProgress?: ProgressCallback
): Promise<FileUploadResponse> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const chunkCount = chunkCountFor(file.size);

  const initRes = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      salt: arrayBufferToBase64(salt),
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      chunkSize: CHUNK_SIZE,
      chunkCount,
      expiresIn: options.expiresIn,
      maxDownloads: options.maxDownloads,
    }),
  });
  if (!initRes.ok) throw new Error(await errorMessage(initRes, 'Could not start the upload'));
  const { id } = (await initRes.json()) as { id: string };

  onProgress?.(0, chunkCount);
  const started = performance.now();
  let finished = 0;
  let storageTotal = 0;
  await runPool(0, chunkCount, CONCURRENCY, async (i) => {
    const plain = await file.slice(i * CHUNK_SIZE, Math.min(file.size, (i + 1) * CHUNK_SIZE)).arrayBuffer();
    const encrypted = await encryptChunk(key, plain, i, i === chunkCount - 1);
    const res = await fetchWithRetry(`/api/files/${id}/chunks/${i}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: encrypted as unknown as BodyInit,
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Upload failed'));
    storageTotal += storageMs(res);
    onProgress?.(++finished, chunkCount);
  });
  logStats('upload', chunkCount, started, storageTotal);

  const done = await fetchWithRetry(`/api/files/${id}/complete`, { method: 'POST' });
  if (!done.ok) throw new Error(await errorMessage(done, 'Could not finish the upload'));
  return done.json();
}

/**
 * Claim one download, then fetch and decrypt the chunks one at a time. A wrong key is
 * detected on the first chunk, so it fails fast without downloading the whole file.
 */
export async function downloadAndDecrypt(
  id: string,
  password: string,
  hooks: { onClaimed?: () => void; onProgress?: ProgressCallback } = {}
): Promise<{ blob: Blob; name: string }> {
  const startRes = await fetch(`/api/files/${id}/download`, { method: 'POST' });
  if (startRes.status === 410 || startRes.status === 404) {
    throw new LinkGoneError(
      startRes.status === 410 ? 'This file has expired or reached its download limit.' : 'File not found.'
    );
  }
  if (!startRes.ok) throw new Error(await errorMessage(startRes, 'Download failed'));
  const session = (await startRes.json()) as {
    token: string;
    salt: string;
    chunkCount: number;
    originalName: string;
    mimeType: string;
  };
  // The server counts this against the download limit, even if decryption fails.
  hooks.onClaimed?.();

  const key = await deriveKey(password, base64ToUint8Array(session.salt));
  const parts: ArrayBuffer[] = new Array(session.chunkCount);
  hooks.onProgress?.(0, session.chunkCount);
  const started = performance.now();
  let finished = 0;
  let storageTotal = 0;

  const fetchChunk = async (i: number) => {
    const res = await fetchWithRetry(`/api/files/${id}/chunks/${i}`, {
      headers: { 'X-Download-Token': session.token },
    });
    if (res.status === 410 || res.status === 404) {
      throw new LinkGoneError(res.status === 410 ? 'This file has expired.' : 'File not found.');
    }
    if (res.status === 401) throw new Error('This download session expired. Open the link again to start over.');
    if (!res.ok) throw new Error(await errorMessage(res, 'Download failed'));
    storageTotal += storageMs(res);
    const encrypted = await res.arrayBuffer();
    parts[i] = await decryptChunk(key, encrypted, i, i === session.chunkCount - 1);
    hooks.onProgress?.(++finished, session.chunkCount);
  };

  // All chunks but the last are fetched a few at a time. The last chunk is requested only
  // after every other one has arrived, because the server treats "last chunk delivered" as
  // "download finished" when it applies burn-after-reading.
  await runPool(0, session.chunkCount - 1, CONCURRENCY, fetchChunk);
  await fetchChunk(session.chunkCount - 1);
  logStats('download', session.chunkCount, started, storageTotal);

  return { blob: new Blob(parts, { type: session.mimeType }), name: session.originalName };
}

export async function getFileInfo(id: string) {
  const res = await fetch(`/api/files/${id}/info`);
  if (res.status === 410) throw new Error('This file has expired.');
  if (res.status === 404) throw new Error('File not found.');
  if (!res.ok) throw new Error(`Failed to get file info: ${res.statusText}`);
  return res.json();
}
