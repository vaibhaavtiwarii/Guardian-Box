import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Shell from '../components/Shell';
import VaultCoin from '../components/VaultCoin';
import PasswordInput from '../components/PasswordInput';
import { IconAlert, IconCheck, IconFile, IconKey, IconSpinner, IconUnlock } from '../components/icons';
import ProgressBar from '../components/ProgressBar';
import { downloadAndDecrypt, getFileInfo, LinkGoneError } from '../utils/api';
import { formatDateTime, formatFileSize, formatTimeLeft } from '../utils/format';
import type { FileInfo } from '../types';

type DownloadState = 'idle' | 'working' | 'complete' | 'error';

/** Read the key from the URL hash. Keys are percent-encoded in the link. */
function readHashKey(): string {
  const raw = window.location.hash.slice(1);
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DownloadPage() {
  const { id } = useParams<{ id: string }>();
  const [hashKey] = useState(readHashKey);
  const [password, setPassword] = useState(hashKey);
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  // Keep the decrypted file in memory so "Save again" doesn't use up another download.
  const decrypted = useRef<{ blob: Blob; name: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    setInfoLoading(true);
    getFileInfo(id)
      .then((info) => {
        setFileInfo(info);
        setInfoError(null);
      })
      .catch((err: Error) => setInfoError(err.message))
      .finally(() => setInfoLoading(false));
  }, [id]);

  const busy = downloadState === 'working';
  const canDownload = password.length > 0 && !busy;

  const handleDecryptAndDownload = async () => {
    if (!id || !password) return;

    if (downloadState === 'complete' && decrypted.current) {
      saveBlob(decrypted.current.blob, decrypted.current.name);
      return;
    }

    try {
      setErrorMsg(null);

      setDownloadState('working');
      setProgress(null);
      const { blob, name } = await downloadAndDecrypt(id, password, {
        // The server counts a claimed download against the limit, even if decryption fails.
        onClaimed: () => setFileInfo((prev) => (prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : prev)),
        onProgress: (done, total) => setProgress({ done, total }),
      });

      decrypted.current = { blob, name };
      saveBlob(blob, name);

      setDownloadState('complete');
    } catch (err) {
      if (err instanceof LinkGoneError) {
        // Expired, used up or deleted while this page was open: show the dead-link screen.
        setInfoError(err.message);
        return;
      }
      setDownloadState('error');
      if (err instanceof DOMException && err.name === 'OperationError') {
        setErrorMsg(
          "That key didn't unlock the file. Check that you copied the whole link, or try the key again."
        );
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    }
  };

  // The link is dead: expired, used up, or never existed
  if (infoError) {
    return (
      <Shell>
       <div className="rounded-[28px] border border-white/10 bg-panel p-6 sm:p-10">
        <div className="flex items-center gap-3 text-alert">
          <span className="flex size-9 items-center justify-center rounded-full bg-alert/15">
            <IconAlert />
          </span>
          <span className="font-medium">{infoError.replace(/\.$/, '')}</span>
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-none tracking-tight sm:text-6xl">
          This link no longer works
        </h1>
        <p className="mt-3 max-w-xl text-steel">
          Shared files are deleted when they expire or reach their download limit. Ask the sender for a new link.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-14 items-center rounded-full bg-paper px-8 font-semibold text-ink hover:bg-white"
        >
          Share a file of your own
        </Link>
       </div>
      </Shell>
    );
  }

  const downloadsLeft =
    fileInfo && fileInfo.maxDownloads !== null ? Math.max(fileInfo.maxDownloads - fileInfo.downloadCount, 0) : null;

  return (
    <Shell>
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm">
            <span className="size-2 rounded-full bg-key" aria-hidden="true" />
            Encrypted file
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[0.98] tracking-tight sm:text-6xl">
            Someone shared a file with you
          </h1>
          <p className="mt-4 max-w-xl text-lg text-steel">
            Your browser unlocks it here. The key stays on this device.
          </p>
        </div>
        <div className="coin hidden w-44 [transform:perspective(900px)_rotateY(-22deg)_rotateX(10deg)] sm:block lg:w-52">
          <VaultCoin glyph="lock" className="w-full drop-shadow-[0_0_34px_rgb(255_130_10/0.35)]" />
        </div>
      </div>

      <div className="mt-10 divide-y divide-white/10 rounded-[28px] border border-white/10 bg-panel">
        {/* File summary */}
        <section className="p-5 sm:p-8" aria-label="File details" aria-busy={infoLoading}>
          {infoLoading || !fileInfo ? (
            <div className="flex items-center gap-4" role="status">
              <span className="size-14 shrink-0 animate-pulse rounded-full bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-raised" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-raised" />
              </div>
              <span className="sr-only">Loading file details</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-raised">
                  <IconFile />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{fileInfo.originalName}</p>
                  <p className="text-sm text-steel">
                    {formatFileSize(fileInfo.size)} encrypted, {fileInfo.mimeType}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-steel">Shared</dt>
                  <dd>{formatDateTime(fileInfo.createdAt)}</dd>
                </div>
                {fileInfo.expiresAt && (
                  <div>
                    <dt className="text-steel">Deleted</dt>
                    <dd>
                      {formatTimeLeft(fileInfo.expiresAt)}
                      <span className="text-steel"> ({formatDateTime(fileInfo.expiresAt)})</span>
                    </dd>
                  </div>
                )}
                {downloadsLeft !== null && (
                  <div>
                    <dt className="text-steel">Downloads left</dt>
                    <dd>
                      {downloadsLeft} of {fileInfo.maxDownloads}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </section>

        {/* Key */}
        <section className="p-5 sm:p-8" aria-label="Key">
          {hashKey ? (
            <p className="flex items-start gap-3 text-sm">
              <IconKey className="mt-0.5 shrink-0 text-key" />
              <span>
                <span className="font-medium">The key is in your link.</span>{' '}
                <span className="text-steel">Nothing to type. It was never sent to the server.</span>
              </span>
            </p>
          ) : (
            <PasswordInput
              password={password}
              setPassword={setPassword}
              label="Decryption key"
              hint="The sender should have given you a key, or a link that ends in one."
              showGenerate={false}
            />
          )}
        </section>

        {/* Action */}
        <section className="p-5 sm:p-8" aria-label="Download">
          <p role="alert" className={errorMsg ? 'mb-4 flex items-start gap-2 text-sm text-alert' : 'sr-only'}>
            {errorMsg && <IconAlert className="mt-0.5 shrink-0" />}
            <span>{errorMsg}</span>
          </p>

          {downloadState === 'complete' && (
            <p role="status" className="mb-4 flex items-start gap-2 text-sm text-safe">
              <IconCheck className="mt-0.5 shrink-0" />
              <span>Unlocked on your device and saved to your downloads folder.</span>
            </p>
          )}

          {busy && progress && progress.total > 1 && (
            <ProgressBar
              done={progress.done}
              total={progress.total}
              label={`Downloading and decrypting part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`}
            />
          )}

          <button
            type="button"
            onClick={handleDecryptAndDownload}
            disabled={!canDownload || infoLoading}
            aria-busy={busy}
            className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-paper text-base font-semibold text-ink transition-colors enabled:hover:bg-white disabled:cursor-not-allowed disabled:bg-raised disabled:text-steel"
          >
            {downloadState === 'working' ? (
              <>
                <IconSpinner />
                Downloading and decrypting…
              </>
            ) : downloadState === 'complete' ? (
              <>
                <IconUnlock />
                Save again
              </>
            ) : (
              <>
                <IconUnlock />
                {downloadState === 'error' ? 'Try again' : 'Decrypt and download'}
              </>
            )}
          </button>
        </section>
      </div>
    </Shell>
  );
}
