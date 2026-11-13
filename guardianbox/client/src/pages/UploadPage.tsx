import { useState } from 'react';
import Header from '../components/Header';
import FileDropZone from '../components/FileDropZone';
import PasswordInput from '../components/PasswordInput';
import ExpirationSettings from '../components/ExpirationSettings';
import ShareLink from '../components/ShareLink';
import { encryptFile } from '../utils/cryptoUtils';
import { uploadEncryptedFile } from '../utils/api';

type UploadState = 'idle' | 'encrypting' | 'uploading' | 'done' | 'error';

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileId, setFileId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canUpload = selectedFile && password.length > 0 && uploadState === 'idle';

  const handleEncryptAndUpload = async () => {
    if (!selectedFile || !password) return;

    try {
      setErrorMsg(null);

      // Step 1: Encrypt
      setUploadState('encrypting');
      const arrayBuffer = await selectedFile.arrayBuffer();
      const { ciphertext, iv, salt } = await encryptFile(arrayBuffer, password);

      // Step 2: Upload
      setUploadState('uploading');
      const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
      const result = await uploadEncryptedFile(
        encryptedBlob,
        iv,
        salt,
        selectedFile.name,
        selectedFile.type || 'application/octet-stream',
        {
          expiresIn: expiresIn ?? undefined,
          maxDownloads: maxDownloads ?? undefined,
        }
      );

      // Step 3: Done
      setFileId(result.id);
      setUploadState('done');
    } catch (err) {
      setUploadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPassword('');
    setExpiresIn(null);
    setMaxDownloads(null);
    setUploadState('idle');
    setFileId(null);
    setErrorMsg(null);
  };

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
            {uploadState === 'done' && fileId ? (
              <>
                <ShareLink fileId={fileId} password={password} />
                <button
                  onClick={handleReset}
                  className="
                    w-full py-3 rounded-xl text-sm font-medium
                    bg-[var(--gb-surface)] border border-[var(--gb-border)]
                    text-[var(--gb-text-muted)] hover:text-[var(--gb-text)] hover:border-[var(--gb-primary)]/50
                    transition-all duration-200
                  "
                >
                  Upload Another File
                </button>
              </>
            ) : (
              <>
                {/* Title */}
                <div>
                  <h2 className="text-xl font-semibold text-[var(--gb-text)]">
                    Upload & Encrypt
                  </h2>
                  <p className="text-sm text-[var(--gb-text-muted)] mt-1">
                    Your file is encrypted in-browser before upload. The server never sees your data.
                  </p>
                </div>

                {/* File drop zone */}
                <FileDropZone
                  onFileSelected={setSelectedFile}
                  selectedFile={selectedFile}
                />

                {/* Password input */}
                <PasswordInput
                  password={password}
                  setPassword={setPassword}
                />

                {/* Expiration settings */}
                <ExpirationSettings
                  expiresIn={expiresIn}
                  setExpiresIn={setExpiresIn}
                  maxDownloads={maxDownloads}
                  setMaxDownloads={setMaxDownloads}
                />

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

                {/* Upload button */}
                <button
                  onClick={handleEncryptAndUpload}
                  disabled={!canUpload}
                  className={`
                    w-full py-4 rounded-xl text-sm font-semibold
                    flex items-center justify-center gap-3
                    transition-all duration-300
                    ${
                      canUpload
                        ? 'bg-[var(--gb-primary)] hover:bg-[var(--gb-primary-hover)] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] cursor-pointer'
                        : uploadState === 'encrypting' || uploadState === 'uploading'
                          ? 'bg-[var(--gb-primary)]/80 text-white/80 cursor-wait'
                          : 'bg-[var(--gb-surface-hover)] text-[var(--gb-text-muted)]/50 cursor-not-allowed border border-[var(--gb-border)]'
                    }
                  `}
                >
                  {uploadState === 'encrypting' ? (
                    <>
                      <Spinner />
                      Encrypting...
                    </>
                  ) : uploadState === 'uploading' ? (
                    <>
                      <Spinner />
                      Uploading...
                    </>
                  ) : uploadState === 'error' ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                      Retry Encrypt & Upload
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Encrypt & Upload
                    </>
                  )}
                </button>

                {/* Security note */}
                <div className="flex items-center justify-center gap-2 text-xs text-[var(--gb-text-muted)]/60">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  End-to-end encrypted with AES-256-GCM
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
    >
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
