interface ExpirationSettingsProps {
  expiresIn: number | null;
  setExpiresIn: (value: number | null) => void;
  maxDownloads: number | null;
  setMaxDownloads: (value: number | null) => void;
}

const EXPIRY_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Never', value: null },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
];

const DOWNLOAD_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Unlimited', value: null },
  { label: '1 download', value: 1 },
  { label: '5 downloads', value: 5 },
  { label: '10 downloads', value: 10 },
];

export default function ExpirationSettings({
  expiresIn,
  setExpiresIn,
  maxDownloads,
  setMaxDownloads,
}: ExpirationSettingsProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-[var(--gb-text-muted)] mb-3">
        Security Settings
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Time-based expiry */}
        <div>
          <label className="block text-xs text-[var(--gb-text-muted)]/70 mb-1.5 uppercase tracking-wider">
            Expires after
          </label>
          <div className="relative">
            <select
              value={expiresIn === null ? '' : String(expiresIn)}
              onChange={(e) =>
                setExpiresIn(e.target.value === '' ? null : Number(e.target.value))
              }
              className="
                w-full px-4 py-3 rounded-xl appearance-none
                bg-[var(--gb-surface)] border border-[var(--gb-border)]
                text-[var(--gb-text)] text-sm
                focus:outline-none focus:border-[var(--gb-primary)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
                transition-all duration-200
                cursor-pointer
              "
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value === null ? '' : String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--gb-text-muted)] pointer-events-none"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Max downloads */}
        <div>
          <label className="block text-xs text-[var(--gb-text-muted)]/70 mb-1.5 uppercase tracking-wider">
            Max downloads
          </label>
          <div className="relative">
            <select
              value={maxDownloads === null ? '' : String(maxDownloads)}
              onChange={(e) =>
                setMaxDownloads(e.target.value === '' ? null : Number(e.target.value))
              }
              className="
                w-full px-4 py-3 rounded-xl appearance-none
                bg-[var(--gb-surface)] border border-[var(--gb-border)]
                text-[var(--gb-text)] text-sm
                focus:outline-none focus:border-[var(--gb-primary)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
                transition-all duration-200
                cursor-pointer
              "
            >
              {DOWNLOAD_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value === null ? '' : String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--gb-text-muted)] pointer-events-none"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
