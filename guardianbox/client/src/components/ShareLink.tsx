import { useState } from 'react';

interface ShareLinkProps {
  fileId: string;
  password: string;
}

export default function ShareLink({ fileId, password }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/file/${fileId}#${password}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Success banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--gb-success)]/10 border border-[var(--gb-success)]/20">
        <div className="w-10 h-10 rounded-full bg-[var(--gb-success)]/20 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div>
          <p className="text-[var(--gb-success)] font-semibold text-sm">File encrypted & uploaded successfully!</p>
          <p className="text-[var(--gb-text-muted)] text-xs mt-0.5">Share the link below to let others download and decrypt the file.</p>
        </div>
      </div>

      {/* Link display */}
      <div className="rounded-xl bg-[var(--gb-surface)] border border-[var(--gb-border)] overflow-hidden">
        <div className="p-4">
          <label className="block text-xs text-[var(--gb-text-muted)] uppercase tracking-wider mb-2 font-medium">
            Share Link
          </label>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-[var(--gb-bg)] border border-[var(--gb-border)] font-mono text-xs text-[var(--gb-accent)] break-all select-all leading-relaxed">
              {shareUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`
                px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium
                transition-all duration-300 flex-shrink-0
                ${
                  copied
                    ? 'bg-[var(--gb-success)] text-white'
                    : 'bg-[var(--gb-primary)] hover:bg-[var(--gb-primary-hover)] text-white'
                }
              `}
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 mt-0.5"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-amber-400/90 text-sm leading-relaxed">
          <strong>Save this link!</strong> It contains the decryption key. If you lose it, the file
          cannot be recovered. The server only stores encrypted data and has no way to decrypt your file.
        </p>
      </div>
    </div>
  );
}
