import cron from 'node-cron';
import { deleteEncryptedBlob } from '../services/storage.service';
import { getExpiredFiles, getMaxedOutFiles, deleteFileRecord } from '../models/file.model';

/**
 * Delete every expired / fully-downloaded file (blob + DB row).
 * Runs hourly via cron AND once at startup, so hosts that sleep when idle
 * (and therefore miss cron ticks) still clean up as soon as they wake.
 */
export async function runCleanup(): Promise<void> {
  console.log('[Cleanup] Running cleanup job...');

  try {
    const expiredFiles = await getExpiredFiles();
    const maxedOutFiles = await getMaxedOutFiles();

    // Combine and deduplicate by id
    const fileMap = new Map<string, { id: string; s3_key: string }>();
    for (const file of [...expiredFiles, ...maxedOutFiles]) {
      fileMap.set(file.id, { id: file.id, s3_key: file.s3_key });
    }

    let cleanedCount = 0;

    for (const file of fileMap.values()) {
      try {
        await deleteEncryptedBlob(file.s3_key);
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
