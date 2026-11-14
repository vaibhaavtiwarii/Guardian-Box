export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

/**
 * The server stores UTC timestamps as "YYYY-MM-DD HH:MM:SS" (no timezone).
 * Parse them as UTC so they display correctly in the viewer's local time.
 */
export function parseServerDate(value: string): Date {
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function formatDateTime(value: string): string {
  return parseServerDate(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatTimeLeft(value: string): string {
  const ms = parseServerDate(value).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'in under a minute';
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

export const EXPIRY_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Never', value: null },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
];

export const DOWNLOAD_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Unlimited', value: null },
  { label: '1', value: 1 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
];

/** Plain-language summary of when the file is deleted. */
export function describeLimits(expiresIn: number | null, maxDownloads: number | null): string {
  const time = EXPIRY_OPTIONS.find((o) => o.value === expiresIn && o.value !== null)?.label;
  const downloads = maxDownloads
    ? `${maxDownloads} download${maxDownloads === 1 ? '' : 's'}`
    : null;
  if (time && downloads) return `The file is deleted after ${time} or ${downloads}, whichever comes first.`;
  if (time) return `The file is deleted after ${time}.`;
  if (downloads) return `The file is deleted after ${downloads}.`;
  return 'No expiry or download limit is set, so the file stays stored until someone deletes it.';
}
