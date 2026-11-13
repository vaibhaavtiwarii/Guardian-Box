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

/**
 * Encrypt file data with AES-256-GCM
 * @param {ArrayBuffer} data - Plaintext file data buffer
 * @param {string} password - Secret password/key
 * @returns {Promise<{ ciphertext: ArrayBuffer, iv: string, salt: string }>}
 */
export async function encryptFile(data, password) {
  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    ciphertext,
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

/**
 * Decrypt file data with AES-256-GCM
 * @param {ArrayBuffer} ciphertext - Encrypted ciphertext buffer
 * @param {string} password - Secret password/key
 * @param {string} ivBase64 - Base64 encoded Initialization Vector
 * @param {string} saltBase64 - Base64 encoded PBKDF2 salt
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptFile(ciphertext, password, ivBase64, saltBase64) {
  const iv = base64ToUint8Array(ivBase64);
  const salt = base64ToUint8Array(saltBase64);
  const key = await deriveKey(password, salt);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
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

