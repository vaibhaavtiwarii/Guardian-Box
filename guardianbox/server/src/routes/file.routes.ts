import { Router } from 'express';
import upload from '../middleware/upload';
import { uploadFile, downloadFile, getFileInfo } from '../controllers/file.controller';

const router = Router();

router.post('/api/files/upload', upload.single('file'), uploadFile);
router.get('/api/files/:id', downloadFile);
router.get('/api/files/:id/info', getFileInfo);

export default router;
