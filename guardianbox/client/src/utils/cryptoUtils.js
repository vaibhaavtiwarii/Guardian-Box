/**
 * GuardianBox Cryptography Module (cryptoUtils.js)
 * Implements Web Crypto API AES-256-GCM and PBKDF2 key derivation.
 * Zero-Knowledge: Plaintext and keys never leave the client browser.
 */

/**
 * Derive a CryptoKey from a password string using PBKDF2
 * @param {string} password - The user password or random key
 * @param {Uint8Array} salt - Random 16-byte salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt) {
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
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a cryptographically secure random salt (16 bytes)
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a cryptographically secure random IV (12 bytes for AES-GCM)
 * @returns {Uint8Array}
 */
export function generateIV() {
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
export function chunkCountFor(size, chunkSize = CHUNK_SIZE) {
  return Math.max(1, Math.ceil(size / chunkSize));
}

/** Total bytes stored on the server for a file of `size` bytes. */
export function encryptedSizeFor(size, chunkSize = CHUNK_SIZE) {
  return size + CHUNK_OVERHEAD * chunkCountFor(size, chunkSize);
}

// Additional authenticated data: chunk index (uint32, big endian) + final-chunk flag.
function chunkAad(index, isFinal) {
  const aad = new Uint8Array(5);
  new DataView(aad.buffer).setUint32(0, index, false);
  aad[4] = isFinal ? 1 : 0;
  return aad;
}

/**
 * Encrypt one chunk. Returns IV || ciphertext || tag.
 * @param {CryptoKey} key
 * @param {ArrayBuffer} plaintext
 * @param {number} index - Position of this chunk in the file
 * @param {boolean} isFinal - True for the last chunk
 * @returns {Promise<Uint8Array>}
 */
export async function encryptChunk(key, plaintext, index, isFinal) {
  const iv = generateIV();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: chunkAad(index, isFinal) },
    key,
    plaintext
  );
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return out;
}

/**
 * Decrypt one chunk produced by encryptChunk. Rejects if the key, position or data is wrong.
 * @param {CryptoKey} key
 * @param {ArrayBuffer|Uint8Array} chunk
 * @param {number} index
 * @param {boolean} isFinal
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptChunk(key, chunk, index, isFinal) {
  const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  if (bytes.byteLength < CHUNK_OVERHEAD) {
    throw new Error('The encrypted data is damaged or incomplete.');
  }
  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: chunkAad(index, isFinal) },
    key,
    ciphertext
  );
}

/**
 * Convenience: encrypt a whole buffer as a single (final) chunk.
 * @param {ArrayBuffer} data - Plaintext file data buffer
 * @param {string} password - Secret password/key
 * @returns {Promise<{ ciphertext: ArrayBuffer, salt: string }>}
 */
export async function encryptFile(data, password) {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const chunk = await encryptChunk(key, data, 0, true);
  return {
    ciphertext: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
    salt: arrayBufferToBase64(salt)
  };
}

/**
 * Convenience: decrypt a buffer produced by encryptFile.
 * @param {ArrayBuffer} ciphertext
 * @param {string} password - Secret password/key
 * @param {string} saltBase64 - Base64 encoded PBKDF2 salt
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptFile(ciphertext, password, saltBase64) {
  const key = await deriveKey(password, base64ToUint8Array(saltBase64));
  return decryptChunk(key, ciphertext, 0, true);
}

/**
 * Generate a secure random password/key string
 * @param {number} length - Desired string length (default: 32)
 * @returns {string}
 */
export function generatePassword(length = 32) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

/**
 * Helper: ArrayBuffer or Uint8Array to base64 string
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

/**
 * Helper: Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

