import multer from 'multer';

// Max size of the *encrypted* upload. Files are buffered in memory (no streaming),
// so keep this modest. Override with MAX_UPLOAD_MB in .env.
export const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '50', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

export default upload;
