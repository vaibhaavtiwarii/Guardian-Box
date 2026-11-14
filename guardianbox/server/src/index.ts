import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fileRoutes from './routes/file.routes';
import { initDb } from './config/db';
import { initStorage } from './services/storage.service';
import { startCleanupJob, runCleanup } from './utils/cleanup';
import { MAX_UPLOAD_MB } from './middleware/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// Behind a reverse proxy (Render etc.) set TRUST_PROXY=1 so req.ip is the real client IP.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// CORS: only needed when the UI is served from a different origin. When Express serves
// the built UI itself (production), requests are same-origin and CORS is not involved.
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));

// Security headers (no extra dependency).
app.disable('x-powered-by');
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer', // never leak the URL (or anything near the #key) via Referer
  });
  if (req.path.startsWith('/api')) {
    res.set({
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    });
  } else {
    res.set('Content-Security-Policy', APP_CSP);
  }
  next();
});

// Minimal in-memory rate limiter for the API (per IP, per minute).
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN || '120', 10);
const hits = new Map<string, { count: number; reset: number }>();
app.use('/api', (req, res, next) => {
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

// Health check endpoint (used by the hosting platform)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use(fileRoutes);

// Serve the built React app (client/dist) from the same server in production.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints files under /assets, so they can be cached forever.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.set('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // Single-page-app fallback: /file/:id, etc. all return index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
  console.log(`[Web] Serving built UI from ${clientDist}`);
} else {
  console.log('[Web] No built UI found (client/dist) — API only. Use the Vite dev server for the UI.');
}

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

// Initialize database + storage, then start accepting requests and the cleanup job.
initDb()
  .then(() => initStorage())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`GuardianBox server running on port ${PORT}`);
    });
    startCleanupJob();
    void runCleanup(); // also clean on startup (hosts that sleep miss cron ticks)
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

export default app;
