import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import fileRoutes from './routes/file.routes';
import './config/db'; // Initialize database on import
import { initStorage } from './services/storage.service';
import { startCleanupJob } from './utils/cleanup';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount routes
app.use(fileRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Initialize storage and start cleanup job
initStorage().then(() => {
  startCleanupJob();
});

app.listen(PORT, () => {
  console.log(`GuardianBox server running on port ${PORT}`);
});

export default app;
