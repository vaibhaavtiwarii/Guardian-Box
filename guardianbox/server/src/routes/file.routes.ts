import { Router } from 'express';
import { rawChunk } from '../middleware/upload';
import {
  initUpload,
  uploadChunk,
  completeUpload,
  startDownload,
  downloadChunk,
  getFileInfo,
} from '../controllers/file.controller';

const router = Router();

// Upload: init -> PUT every chunk -> complete
router.post('/api/files', initUpload);
router.put('/api/files/:id/chunks/:index', rawChunk, uploadChunk);
router.post('/api/files/:id/complete', completeUpload);

// Download: info (free) -> start (claims one download) -> GET every chunk
router.get('/api/files/:id/info', getFileInfo);
router.post('/api/files/:id/download', startDownload);
router.get('/api/files/:id/chunks/:index', downloadChunk);

export default router;
