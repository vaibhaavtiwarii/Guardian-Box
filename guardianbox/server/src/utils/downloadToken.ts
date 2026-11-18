import crypto from 'crypto';

/**
 * A download token proves that a download slot was claimed for one file, so the recipient
 * can fetch the chunks one by one without claiming a slot per chunk. It is an HMAC over
 * "<file id>.<expiry>", so it cannot be forged or reused for another file.
 *
 * Set DOWNLOAD_TOKEN_SECRET to keep tokens valid across restarts; otherwise a random
 * secret is created at start-up (a restart then invalidates downloads that are in progress).
 */
const SECRET = process.env.DOWNLOAD_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

/** How long a claimed download may take. */
export const TOKEN_TTL_MINUTES = 120;

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createDownloadToken(fileId: string): string {
  const expires = Date.now() + TOKEN_TTL_MINUTES * 60_000;
  const payload = `${fileId}.${expires}`;
  return `${expires}.${sign(payload)}`;
}

export function verifyDownloadToken(fileId: string, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(`${fileId}.${expires}`));
  const given = Buffer.from(token.slice(dot + 1));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
