import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import PasswordInput from '../components/PasswordInput';
import { decryptFile } from '../utils/cryptoUtils';
import { downloadEncryptedFile, getFileInfo } from '../utils/api';
import type { FileInfo } from '../types';

type DownloadState = 'idle' | 'fetching' | 'decrypting' | 'complete' | 'error';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function DownloadPage() {
  const { id } = useParams<{ id: string }>();
  const [password, setPassword] = useState('');
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Extract password from hash fragment
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setPassword(hash);
    }
  }, []);

  // Fetch file info on mount
  useEffect(() => {
    if (!id) return;
    setInfoLoading(true);
    getFileInfo(id)
      .then((info) => {
        setFileInfo(info);
        setInfoError(null);
      })
      .catch((err: Error) => {
        setInfoError(err.message);
      })
      .finally(() => setInfoLoading(false));
  }, [id]);

  const handleDecryptAndDownload = async () => {
    if (!id || !password) return;

    try {
      setErrorMsg(null);

      // Step 1: Download encrypted file
      setDownloadState('fetching');
      const { blob, iv, salt, originalName, mimeType } = await downloadEncryptedFile(id);

      // Step 2: Decrypt
      setDownloadState('decrypting');
      const encryptedBuffer = await blob.arrayBuffer();
      const decryptedBuffer = await decryptFile(encryptedBuffer, password, iv, salt);

      // Step 3: Trigger browser download
      const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadState('complete');
    } catch (err) {
      setDownloadState('error');
      if (err instanceof DOMException && err.name === 'OperationError') {
        setErrorMsg('Decryption failed. The password may be incorrect.');
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected error occurred.');
      }
    }
  };

  const canDownload = password.length > 0 && downloadState !== 'fetching' && downloadState !== 'decrypting';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div
            className="
              rounded-2xl border border-[var(--gb-border)]
              bg-[var(--gb-surface)]/60 backdrop-blur-xl
              shadow-[0_0_60px_rgba(99,102,241,0.04)]
              p-6 sm:p-8
              space-y-6
            "
          >
            <div>
              <h2 className="text-xl font-semibold text-[var(--gb-text)]">
                Download & Decrypt
              </h2>
              <p className="text-sm text-[var(--gb-text-muted)] mt-1">
                Your file will be decrypted in-browser. The server never sees your decryption key.
              </p>
            </div>

            {/* File info */}
            {infoLoading ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--gb-surface)] border border-[var(--gb-border)]">
                <SpinnerSmall />
                <span className="text-sm text-[var(--gb-text-muted)]">Loading file info...</span>
              </div>
            ) : infoError ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--gb-danger)]/10 border border-[var(--gb-danger)]/20 text-[var(--gb-danger)] text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {infoError}
              </div>
            ) : fileInfo ? (
              <div className="rounded-xl bg-[var(--gb-surface)] border border-[var(--gb-border)] overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* File icon and name */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[var(--gb-primary)]/10 flex items-center justify-center flex-shrink-0">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--gb-text)] font-medium truncate">{fileInfo.originalName}</p>
                      <p className="text-xs text-[var(--gb-text-muted)]">{formatFileSize(fileInfo.size)}</p>
                    </div>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--gb-border)]">
                    <div>
                      <p className="text-xs text-[var(--gb-text-muted)]/70 uppercase tracking-wider">Uploaded</p>
                      <p className="text-sm text-[var(--gb-text)] mt-0.5">{formatDate(fileInfo.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--gb-text-muted)]/70 uppercase tracking-wider">Type</p>
                      <p className="text-sm text-[var(--gb-text)] mt-0.5">{fileInfo.mimeType}</p>
                    </div>
                    {fileInfo.expiresAt && (
                      <div>
                        <p className="text-xs text-[var(--gb-text-muted)]/70 uppercase tracking-wider">Expires</p>
                        <p className="text-sm text-amber-400 mt-0.5">{formatDate(fileInfo.expiresAt)}</p>
                      </div>
                    )}
                    {fileInfo.maxDownloads !== null && (
                      <div>
                        <p className="text-xs text-[var(--gb-text-muted)]/70 uppercase tracking-wider">Downloads</p>
                        <p className="text-sm text-[var(--gb-text)] mt-0.5">
                          {fileInfo.downloadCount} / {fileInfo.maxDownloads}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Password input - only show if no hash password */}
            {!window.location.hash.slice(1) && (
              <PasswordInput
                password={password}
                setPassword={setPassword}
                label="Decryption Key"
              />
            )}

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-[var(--gb-danger)]/10 border border-[var(--gb-danger)]/20 text-[var(--gb-danger)] text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMsg}
              </div>
            )}

            {/* Download complete */}
            {downloadState === 'complete' && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--gb-success)]/10 border border-[var(--gb-success)]/20">
                <div className="w-10 h-10 rounded-full bg-[var(--gb-success)]/20 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--gb-success)] font-semibold text-sm">File decrypted & downloaded!</p>
                  <p className="text-[var(--gb-text-muted)] text-xs mt-0.5">The file has been decrypted in your browser and saved to your downloads folder.</p>
                </div>
              </div>
            )}

            {/* Download button */}
            <button
              onClick={handleDecryptAndDownload}
              disabled={!canDownload || !!infoError}
              className={`
                w-full py-4 rounded-xl text-sm font-semibold
                flex items-center justify-center gap-3
                transition-all duration-300
                ${
                  canDownload && !infoError
                    ? 'bg-[var(--gb-primary)] hover:bg-[var(--gb-primary-hover)] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] cursor-pointer'
                    : downloadState === 'fetching' || downloadState === 'decrypting'
                      ? 'bg-[var(--gb-primary)]/80 text-white/80 cursor-wait'
                      : 'bg-[var(--gb-surface-hover)] text-[var(--gb-text-muted)]/50 cursor-not-allowed border border-[var(--gb-border)]'
                }
              `}
            >
              {downloadState === 'fetching' ? (
                <>
                  <Spinner />
                  Downloading...
                </>
              ) : downloadState === 'decrypting' ? (
                <>
                  <Spinner />
                  Decrypting...
                </>
              ) : downloadState === 'complete' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Again
                </>
              ) : downloadState === 'error' ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Retry
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                  Decrypt & Download
                </>
              )}
            </button>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--gb-text-muted)]/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Decrypted locally with AES-256-GCM — your key never leaves your browser
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="15.7 47.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpinnerSmall() {
  return (
    <svg className="animate-spin h-4 w-4 text-[var(--gb-text-muted)]" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="15.7 47.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
