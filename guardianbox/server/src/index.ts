import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fileRoutes from './routes/file.routes';
import './config/db'; // Initialize database on import
import { initStorage } from './services/storage.service';
import { startCleanupJob } from './utils/cleanup';
import { MAX_UPLOAD_MB } from './middleware/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: restrict to known origins in production (comma-separated list in CORS_ORIGIN).
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));

// Basic security headers (no extra dependency).
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer', // never leak the URL (or anything near the #key) via Referer
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
  next();
});

// Minimal in-memory rate limiter (per IP, per minute).
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN || '120', 10);
const hits = new Map<string, { count: number; reset: number }>();
app.use((req, res, next) => {
  const now = Date.now();
  const ip = req.ip || 'unknown';
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (e.reset < now) hits.delete(ip);
}, 60_000).unref();

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

// Upload errors (e.g. file too large) -> clean JSON instead of an HTML stack trace.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${MAX_UPLOAD_MB} MB)` : err.message;
    res.status(status).json({ error: msg });
    return;
  }
  next(err);
});

// Initialize storage and start cleanup job
initStorage()
  .then(() => {
    startCleanupJob();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`GuardianBox server running on port ${PORT}`);
});

export default app;
