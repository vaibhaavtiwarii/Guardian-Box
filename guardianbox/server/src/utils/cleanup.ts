import cron from 'node-cron';
import { deleteFileBlobs } from '../services/storage.service';
import { TOKEN_TTL_MINUTES } from './downloadToken';
import {
  getExpiredFiles,
  getMaxedOutFiles,
  getStalePendingFiles,
  deleteFileRecord,
} from '../models/file.model';

// Uploads that never finished (browser closed halfway) are removed after this long.
const PENDING_UPLOAD_MINUTES = 60;

/**
 * Delete every expired / fully-downloaded / abandoned file (all chunks + DB row).
 * Runs hourly via cron AND once at startup, so hosts that sleep when idle
 * (and therefore miss cron ticks) still clean up as soon as they wake.
 */
export async function runCleanup(): Promise<void> {
  console.log('[Cleanup] Running cleanup job...');

  try {
    const expiredFiles = await getExpiredFiles();
    const maxedOutFiles = await getMaxedOutFiles(TOKEN_TTL_MINUTES);
    const stalePending = await getStalePendingFiles(PENDING_UPLOAD_MINUTES);

    // Combine and deduplicate by id
    const fileMap = new Map<string, { id: string; s3_key: string; chunk_count: number }>();
    for (const file of [...expiredFiles, ...maxedOutFiles, ...stalePending]) {
      fileMap.set(file.id, { id: file.id, s3_key: file.s3_key, chunk_count: file.chunk_count });
    }

    let cleanedCount = 0;

    for (const file of fileMap.values()) {
      try {
        await deleteFileBlobs(file.s3_key, file.chunk_count);
        await deleteFileRecord(file.id);
        cleanedCount++;
      } catch (err) {
        console.error(`[Cleanup] Failed to clean up file ${file.id}:`, err);
      }
    }

    console.log(`[Cleanup] Cleaned up ${cleanedCount} file(s).`);
  } catch (error) {
    console.error('[Cleanup] Cleanup job failed:', error);
  }
}

export function startCleanupJob(): void {
  cron.schedule('0 * * * *', () => {
    void runCleanup();
  });

  console.log('[Cleanup] Cleanup job scheduled (runs every hour).');
}
