import cron from 'node-cron';
import { deleteEncryptedBlob } from '../services/storage.service';
import { getExpiredFiles, getMaxedOutFiles, deleteFileRecord } from '../models/file.model';

export function startCleanupJob(): void {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cleanup] Running cleanup job...');

    try {
      const expiredFiles = getExpiredFiles();
      const maxedOutFiles = getMaxedOutFiles();

      // Combine and deduplicate by id
      const fileMap = new Map<string, { id: string; s3_key: string }>();
      for (const file of [...expiredFiles, ...maxedOutFiles]) {
        fileMap.set(file.id, { id: file.id, s3_key: file.s3_key });
      }

      const filesToClean = Array.from(fileMap.values());
      let cleanedCount = 0;

      for (const file of filesToClean) {
        try {
          // Delete from storage
          await deleteEncryptedBlob(file.s3_key);

          // Delete from DB
          deleteFileRecord(file.id);
          cleanedCount++;
        } catch (err) {
          console.error(`[Cleanup] Failed to clean up file ${file.id}:`, err);
        }
      }

      console.log(`[Cleanup] Cleaned up ${cleanedCount} file(s).`);
    } catch (error) {
      console.error('[Cleanup] Cleanup job failed:', error);
    }
  });

  console.log('[Cleanup] Cleanup job scheduled (runs every hour).');
}
