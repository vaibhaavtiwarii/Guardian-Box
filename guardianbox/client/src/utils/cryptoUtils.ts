/**
 * GuardianBox Cryptography Module
 * Uses the Web Crypto API for AES-256-GCM encryption/decryption.
 * All cryptography happens client-side — the server never sees plaintext or keys.
 */

// Derive a CryptoKey from a password string using PBKDF2
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 600000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate a random salt
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Generate a random 12-byte IV for AES-GCM (a fresh one for every chunk)
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// ---------------------------------------------------------------------------
// Chunked encryption
//
// Big files are split into CHUNK_SIZE pieces and each piece is encrypted on its own,
// so neither the browser nor the server ever has to hold the whole file at once.
//
//   stored chunk  =  IV (12 random bytes)  ||  AES-GCM ciphertext + 16-byte tag
//
// Every chunk is authenticated together with its position (index + "this is the last
// chunk" flag) as additional data. A server that reorders, duplicates, drops or
// truncates chunks therefore makes decryption fail instead of returning a damaged file.
// ---------------------------------------------------------------------------

export const CHUNK_SIZE = 4 * 1024 * 1024; // plaintext bytes per chunk
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const CHUNK_OVERHEAD = IV_BYTES + TAG_BYTES; // bytes added to every chunk

/** How many chunks a file of `size` bytes is split into (an empty file still has one). */
export function chunkCountFor(size: number, chunkSize: number = CHUNK_SIZE): number {
  return Math.max(1, Math.ceil(size / chunkSize));
}

/** Total bytes stored on the server for a file of `size` bytes. */
export function encryptedSizeFor(size: number, chunkSize: number = CHUNK_SIZE): number {
  return size + CHUNK_OVERHEAD * chunkCountFor(size, chunkSize);
}

// Additional authenticated data: chunk index (uint32, big endian) + final-chunk flag.
function chunkAad(index: number, isFinal: boolean): Uint8Array {
  const aad = new Uint8Array(5);
  new DataView(aad.buffer).setUint32(0, index, false);
  aad[4] = isFinal ? 1 : 0;
  return aad;
}

/** Encrypt one chunk. Returns IV || ciphertext || tag. */
export async function encryptChunk(
  key: CryptoKey,
  plaintext: ArrayBuffer,
  index: number,
  isFinal: boolean
): Promise<Uint8Array> {
  const iv = generateIV();
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: chunkAad(index, isFinal) as unknown as BufferSource,
    },
    key,
    plaintext
  );
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return out;
}

/** Decrypt one chunk produced by encryptChunk. Rejects if the key, position or data is wrong. */
export async function decryptChunk(
  key: CryptoKey,
  chunk: ArrayBuffer | Uint8Array,
  index: number,
  isFinal: boolean
): Promise<ArrayBuffer> {
  const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  if (bytes.byteLength < CHUNK_OVERHEAD) {
    throw new Error('The encrypted data is damaged or incomplete.');
  }
  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: chunkAad(index, isFinal) as unknown as BufferSource,
    },
    key,
    ciphertext
  );
}

/** Convenience: encrypt a whole buffer as a single (final) chunk. */
export async function encryptFile(
  data: ArrayBuffer,
  password: string
): Promise<{ ciphertext: ArrayBuffer; salt: string }> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const chunk = await encryptChunk(key, data, 0, true);
  return {
    ciphertext: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer,
    salt: arrayBufferToBase64(salt),
  };
}

/** Convenience: decrypt a buffer produced by encryptFile. */
export async function decryptFile(
  ciphertext: ArrayBuffer,
  password: string,
  saltBase64: string
): Promise<ArrayBuffer> {
  const key = await deriveKey(password, base64ToUint8Array(saltBase64));
  return decryptChunk(key, ciphertext, 0, true);
}

// Generate a random password/key string
export function generatePassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

// Helper: ArrayBuffer/Uint8Array to base64
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// Helper: base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
