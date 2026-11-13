import { describe, it, expect } from 'vitest';
import {
  encryptFile,
  decryptFile,
  generatePassword,
  generateSalt,
  generateIV,
  arrayBufferToBase64,
  base64ToUint8Array,
} from './cryptoUtils';

describe('GuardianBox Web Crypto Engine (E2EE)', () => {
  it('should encrypt data with a key and decrypt back to exact original data', async () => {
    const originalText = 'Zero-Knowledge Privacy: Whistleblowers & Journalists Confidential Data 2026';
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode(originalText).buffer as ArrayBuffer;
    const password = 'CorrectHorseBatteryStaple#2026';

    // 1. Encrypt
    const { ciphertext, iv, salt } = await encryptFile(originalBuffer, password);

    expect(ciphertext).toBeDefined();
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    expect(iv).toBeDefined();
    expect(salt).toBeDefined();

    // Verify ciphertext is distinct from original buffer
    const decoder = new TextDecoder();
    expect(decoder.decode(ciphertext)).not.toBe(originalText);

    // 2. Decrypt
    const decryptedBuffer = await decryptFile(ciphertext, password, iv, salt);
    const decryptedText = decoder.decode(decryptedBuffer);

    expect(decryptedText).toBe(originalText);
  });

  it('should handle binary data roundtrip correctly', async () => {
    // 64 KB of arbitrary binary data
    const binaryData = new Uint8Array(64 * 1024);
    for (let i = 0; i < binaryData.length; i++) {
      binaryData[i] = i % 256;
    }
    const password = generatePassword(32);

    const { ciphertext, iv, salt } = await encryptFile(binaryData.buffer as ArrayBuffer, password);
    const decryptedBuffer = await decryptFile(ciphertext, password, iv, salt);
    const decryptedBytes = new Uint8Array(decryptedBuffer);

    expect(decryptedBytes.length).toBe(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      if (binaryData[i] !== decryptedBytes[i]) {
        throw new Error(`Byte mismatch at index ${i}`);
      }
    }
  });

  it('should reject decryption when wrong password is supplied (authentication tag failure)', async () => {
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode('Confidential Report').buffer as ArrayBuffer;
    const password = 'SecretPassword123';
    const wrongPassword = 'WrongPassword456';

    const { ciphertext, iv, salt } = await encryptFile(originalBuffer, password);

    await expect(
      decryptFile(ciphertext, wrongPassword, iv, salt)
    ).rejects.toThrow();
  });

  it('should reject decryption if ciphertext has been tampered with (AES-GCM integrity)', async () => {
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode('Integrity Protected Payload').buffer as ArrayBuffer;
    const password = 'SuperSecretKey';

    const { ciphertext, iv, salt } = await encryptFile(originalBuffer, password);

    // Tamper with one byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      decryptFile(tampered.buffer as ArrayBuffer, password, iv, salt)
    ).rejects.toThrow();
  });

  it('should generate distinct salt and IV on every call', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1.length).toBe(16);
    expect(salt2.length).toBe(16);
    expect(arrayBufferToBase64(salt1)).not.toBe(arrayBufferToBase64(salt2));

    const iv1 = generateIV();
    const iv2 = generateIV();
    expect(iv1.length).toBe(12);
    expect(iv2.length).toBe(12);
    expect(arrayBufferToBase64(iv1)).not.toBe(arrayBufferToBase64(iv2));
  });

  it('should generate secure random passwords of requested length', () => {
    const p1 = generatePassword(32);
    const p2 = generatePassword(32);
    expect(p1.length).toBe(32);
    expect(p2.length).toBe(32);
    expect(p1).not.toBe(p2);
  });

  it('should accurately encode and decode base64 strings', () => {
    const bytes = new Uint8Array([0, 1, 10, 50, 100, 200, 255]);
    const b64 = arrayBufferToBase64(bytes);
    const restored = base64ToUint8Array(b64);
    expect(Array.from(restored)).toEqual(Array.from(bytes));
  });
});

