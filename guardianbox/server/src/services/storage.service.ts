import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import s3Client from '../config/s3';

const S3_BUCKET = process.env.S3_BUCKET || 'guardianbox-uploads';
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '..', '..', 'storage', S3_BUCKET);

let useLocalFallback = process.env.STORAGE_MODE === 'local';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Ensure local directory exists if fallback is used
function ensureLocalDir(keyPath: string) {
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function initStorage(): Promise<void> {
  if (useLocalFallback) {
    console.log(`[Storage] Configured to use local storage at: ${LOCAL_STORAGE_DIR}`);
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
    return;
  }

  try {
    // Check if S3 / MinIO is accessible
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`[Storage] Connected to S3/MinIO bucket "${S3_BUCKET}".`);
  } catch (err: any) {
    // If bucket doesn't exist, try to create it (MinIO standard)
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
        console.log(`[Storage] Created S3/MinIO bucket "${S3_BUCKET}".`);
        return;
      } catch (createErr) {
        console.warn(`[Storage] Could not create bucket "${S3_BUCKET}":`, createErr);
      }
    }

    console.warn(`[Storage] S3/MinIO is not reachable (${err?.message || err}). Falling back to local encrypted object storage at: ${LOCAL_STORAGE_DIR}`);
    useLocalFallback = true;
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
  }
}

export async function putEncryptedBlob(key: string, data: Buffer, contentType: string = 'application/octet-stream'): Promise<void> {
  if (!useLocalFallback) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: data,
          ContentType: contentType,
        })
      );
      return;
    } catch (err) {
      console.warn(`[Storage] S3 upload failed, using local storage:`, err);
      useLocalFallback = true;
    }
  }

  // Local object storage fallback
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  ensureLocalDir(filePath);
  await fs.promises.writeFile(filePath, data);
}

export async function getEncryptedBlob(key: string): Promise<Buffer> {
  if (!useLocalFallback) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new Error('Empty S3 object body');
      }

      return await streamToBuffer(response.Body as Readable);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey') {
        throw new Error('Object not found in storage');
      }
      console.warn(`[Storage] S3 read failed, trying local storage:`, err);
    }
  }

  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  if (!fs.existsSync(filePath)) {
    throw new Error('Object not found in storage');
  }
  return await fs.promises.readFile(filePath);
}

export async function deleteEncryptedBlob(key: string): Promise<void> {
  if (!useLocalFallback) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );
      return;
    } catch (err) {
      console.warn(`[Storage] S3 delete failed, checking local storage:`, err);
    }
  }

  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

