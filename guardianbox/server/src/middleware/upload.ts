import express from 'express';

// Largest file a user may share (plaintext bytes). Files are uploaded in chunks, so this
// is no longer limited by server memory; it bounds storage use and browser memory.
export const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);

// Allowed plaintext chunk size range. The client uses 4 MiB.
export const MIN_CHUNK_BYTES = 64 * 1024;
export const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

// Bytes added to each chunk by encryption: 12-byte IV + 16-byte GCM tag.
export const CHUNK_OVERHEAD = 28;

// Raw body parser for a single chunk. Exact sizes are validated against the file record.
export const rawChunk = express.raw({
  type: 'application/octet-stream',
  limit: MAX_CHUNK_BYTES + CHUNK_OVERHEAD,
});
