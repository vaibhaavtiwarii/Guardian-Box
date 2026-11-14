import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  // Path-style addressing is needed for local MinIO/RustFS. Hosted providers such as
  // Tigris use virtual-hosted style, so set S3_FORCE_PATH_STYLE=false there.
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  // Don't send optional CRC checksums that some S3-compatible stores reject.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export default s3Client;
