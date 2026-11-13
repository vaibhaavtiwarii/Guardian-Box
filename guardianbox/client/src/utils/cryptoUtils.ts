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

// Generate a random IV for AES-GCM
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Encrypt file data with AES-256-GCM
export async function encryptFile(
  data: ArrayBuffer,
  password: string
): Promise<{ ciphertext: ArrayBuffer; iv: string; salt: string }> {
  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(password, salt);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    data
  );
  
  // Encode iv and salt as base64 for transmission
  return {
    ciphertext,
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

// Decrypt file data with AES-256-GCM
export async function decryptFile(
  ciphertext: ArrayBuffer,
  password: string,
  ivBase64: string,
  saltBase64: string
): Promise<ArrayBuffer> {
  const iv = base64ToUint8Array(ivBase64);
  const salt = base64ToUint8Array(saltBase64);
  const key = await deriveKey(password, salt);
  
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext
  );
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
