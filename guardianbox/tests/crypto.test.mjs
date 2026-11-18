import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_OVERHEAD,
  chunkCountFor,
  decryptChunk,
  deriveKey,
  encryptChunk,
  encryptFile,
  decryptFile,
  generatePassword,
  generateSalt,
  generateIV,
  arrayBufferToBase64,
  base64ToUint8Array,
} from '../client/src/utils/cryptoUtils.js';

test('GuardianBox Web Crypto Engine (E2EE)', async (t) => {
  await t.test('encrypt(data, key) followed by decrypt(ciphertext, key) returns original data', async () => {
    const originalText = 'Zero-Knowledge Privacy: Whistleblowers & Journalists Confidential Data 2026';
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode(originalText).buffer;
    const password = 'CorrectHorseBatteryStaple#2026';

    // 1. Encrypt
    const { ciphertext, salt } = await encryptFile(originalBuffer, password);
    assert.ok(ciphertext.byteLength > 0, 'Ciphertext should be non-empty');
    assert.ok(salt, 'Salt should be present');

    // 2. Decrypt
    const decryptedBuffer = await decryptFile(ciphertext, password, salt);
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedBuffer);

    assert.equal(decryptedText, originalText, 'Decrypted text must match original plaintext');
  });

  await t.test('binary data (64KB) encrypt and decrypt roundtrip matches byte-for-byte', async () => {
    const binaryData = new Uint8Array(64 * 1024);
    for (let i = 0; i < binaryData.length; i++) {
      binaryData[i] = i % 256;
    }
    const password = generatePassword(32);

    const { ciphertext, salt } = await encryptFile(binaryData.buffer, password);
    const decryptedBuffer = await decryptFile(ciphertext, password, salt);
    const decryptedBytes = new Uint8Array(decryptedBuffer);

    assert.equal(decryptedBytes.length, binaryData.length, 'Length must match');
    assert.deepEqual(decryptedBytes, binaryData, 'All bytes must match exactly');
  });

  await t.test('wrong password causes decryption failure (AES-GCM tag mismatch)', async () => {
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode('Confidential Report').buffer;
    const password = 'SecretPassword123';
    const wrongPassword = 'WrongPassword456';

    const { ciphertext, salt } = await encryptFile(originalBuffer, password);

    await assert.rejects(
      async () => {
        await decryptFile(ciphertext, wrongPassword, salt);
      },
      /operation failed|tag|error/i,
      'Decryption with wrong password should fail authentication check'
    );
  });

  await t.test('tampered ciphertext causes decryption failure (AES-GCM integrity check)', async () => {
    const encoder = new TextEncoder();
    const originalBuffer = encoder.encode('Integrity Protected Payload').buffer;
    const password = 'SuperSecretKey';

    const { ciphertext, salt } = await encryptFile(originalBuffer, password);

    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff; // Flip bits in first byte

    await assert.rejects(
      async () => {
        await decryptFile(tampered.buffer, password, salt);
      },
      'Tampered ciphertext must be rejected by AES-GCM'
    );
  });

  await t.test('fresh salt and IV are produced on every run', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    assert.equal(s1.length, 16);
    assert.notEqual(arrayBufferToBase64(s1), arrayBufferToBase64(s2));

    const iv1 = generateIV();
    const iv2 = generateIV();
    assert.equal(iv1.length, 12);
    assert.notEqual(arrayBufferToBase64(iv1), arrayBufferToBase64(iv2));
  });

  await t.test('base64 encode and decode helper works correctly', () => {
    const bytes = new Uint8Array([0, 1, 10, 50, 100, 200, 255]);
    const b64 = arrayBufferToBase64(bytes);
    const restored = base64ToUint8Array(b64);
    assert.deepEqual(restored, bytes);
  });
});

test('chunked encryption', async (t) => {
  const key = await deriveKey('chunk-test-key', generateSalt());
  const bytes = (n, fill) => new Uint8Array(n).fill(fill).buffer;

  await t.test('round-trips several chunks and adds exactly 28 bytes per chunk', async () => {
    const parts = [bytes(1000, 1), bytes(1000, 2), bytes(10, 3)];
    const enc = [];
    for (let i = 0; i < parts.length; i++) enc.push(await encryptChunk(key, parts[i], i, i === parts.length - 1));
    for (let i = 0; i < enc.length; i++) {
      assert.equal(enc[i].byteLength, parts[i].byteLength + CHUNK_OVERHEAD);
      const dec = new Uint8Array(await decryptChunk(key, enc[i], i, i === enc.length - 1));
      assert.deepEqual(Array.from(dec), Array.from(new Uint8Array(parts[i])));
    }
  });

  await t.test('uses a fresh IV for every chunk, even for identical plaintext', async () => {
    const a = await encryptChunk(key, bytes(64, 7), 0, false);
    const b = await encryptChunk(key, bytes(64, 7), 0, false);
    assert.notDeepEqual(Array.from(a.slice(0, 12)), Array.from(b.slice(0, 12)));
  });

  await t.test('rejects chunks that were reordered, moved or marked as final', async () => {
    const c0 = await encryptChunk(key, bytes(100, 1), 0, false);
    await assert.rejects(decryptChunk(key, c0, 1, false));
    await assert.rejects(decryptChunk(key, c0, 0, true));
  });

  await t.test('rejects a tampered or too-short chunk', async () => {
    const c = await encryptChunk(key, bytes(100, 1), 0, true);
    const tampered = c.slice();
    tampered[20] ^= 0xff;
    await assert.rejects(decryptChunk(key, tampered, 0, true));
    await assert.rejects(decryptChunk(key, new Uint8Array(10), 0, true));
  });

  await t.test('counts chunks correctly', () => {
    assert.equal(chunkCountFor(0, 100), 1);
    assert.equal(chunkCountFor(100, 100), 1);
    assert.equal(chunkCountFor(101, 100), 2);
  });
});
