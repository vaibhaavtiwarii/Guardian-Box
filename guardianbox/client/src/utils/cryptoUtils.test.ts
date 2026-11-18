import { describe, it, expect } from 'vitest';
import {
  CHUNK_OVERHEAD,
  chunkCountFor,
  decryptChunk,
  deriveKey,
  encryptChunk,
  encryptedSizeFor,
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
    const { ciphertext, salt } = await encryptFile(originalBuffer, password);

    expect(ciphertext).toBeDefined();
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    expect(salt).toBeDefined();

    // Verify ciphertext is distinct from original buffer
    const decoder = new TextDecoder();
    expect(decoder.decode(ciphertext)).not.toBe(originalText);

    // 2. Decrypt
    const decryptedBuffer = await decryptFile(ciphertext, password, salt);
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

    const { ciphertext, salt } = await encryptFile(binaryData.buffer as ArrayBuffer, password);
    const decryptedBuffer = await decryptFile(ciphertext, password, salt);
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

    const { ciphertext, salt } = await encryptFile(originalBuffer, password);

    await expect(
      decryptFile(ciphertext, wrongPassword, salt)
    ).rejects.toThrow();
  });

  it('should reject decryption if ciphertext has been tampered with (AES-GCM integrity)', async () => {
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode('Integrity Protected Payload').buffer as ArrayBuffer;
    const password = 'SuperSecretKey';

    const { ciphertext, salt } = await encryptFile(originalBuffer, password);

    // Tamper with one byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      decryptFile(tampered.buffer as ArrayBuffer, password, salt)
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

  describe('chunked encryption', () => {
    const makeKey = async () => deriveKey('chunk-test-key', generateSalt());
    const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill).buffer as ArrayBuffer;

    it('round-trips several chunks and adds exactly 28 bytes per chunk', async () => {
      const key = await makeKey();
      const parts = [bytes(1000, 1), bytes(1000, 2), bytes(10, 3)];
      const enc = [];
      for (let i = 0; i < parts.length; i++) enc.push(await encryptChunk(key, parts[i], i, i === parts.length - 1));
      enc.forEach((c, i) => expect(c.byteLength).toBe(parts[i].byteLength + CHUNK_OVERHEAD));
      for (let i = 0; i < enc.length; i++) {
        const dec = new Uint8Array(await decryptChunk(key, enc[i], i, i === enc.length - 1));
        expect(Array.from(dec)).toEqual(Array.from(new Uint8Array(parts[i])));
      }
    });

    it('uses a fresh IV for every chunk, even for identical plaintext', async () => {
      const key = await makeKey();
      const a = await encryptChunk(key, bytes(64, 7), 0, false);
      const b = await encryptChunk(key, bytes(64, 7), 0, false);
      expect(Array.from(a.slice(0, 12))).not.toEqual(Array.from(b.slice(0, 12)));
    });

    it('rejects chunks that were reordered, moved or marked as final', async () => {
      const key = await makeKey();
      const c0 = await encryptChunk(key, bytes(100, 1), 0, false);
      await expect(decryptChunk(key, c0, 1, false)).rejects.toThrow(); // wrong position
      await expect(decryptChunk(key, c0, 0, true)).rejects.toThrow(); // truncation looks like "final"
    });

    it('rejects a tampered or too-short chunk', async () => {
      const key = await makeKey();
      const c = await encryptChunk(key, bytes(100, 1), 0, true);
      const tampered = c.slice();
      tampered[20] ^= 0xff;
      await expect(decryptChunk(key, tampered, 0, true)).rejects.toThrow();
      await expect(decryptChunk(key, new Uint8Array(10), 0, true)).rejects.toThrow();
    });

    it('counts chunks and sizes correctly', () => {
      expect(chunkCountFor(0, 100)).toBe(1);
      expect(chunkCountFor(100, 100)).toBe(1);
      expect(chunkCountFor(101, 100)).toBe(2);
      expect(encryptedSizeFor(250, 100)).toBe(250 + 3 * CHUNK_OVERHEAD);
    });
  });
});
