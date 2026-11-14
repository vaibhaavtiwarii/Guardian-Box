import { useState } from 'react';
import Shell from '../components/Shell';
import FileDropZone from '../components/FileDropZone';
import PasswordInput from '../components/PasswordInput';
import ExpirationSettings from '../components/ExpirationSettings';
import ShareLink from '../components/ShareLink';
import { IconAlert, IconCheck, IconLock, IconSpinner } from '../components/icons';
import { encryptFile } from '../utils/cryptoUtils';
import { uploadEncryptedFile } from '../utils/api';
import { describeLimits, formatFileSize } from '../utils/format';

type UploadState = 'idle' | 'encrypting' | 'uploading' | 'done' | 'error';

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileId, setFileId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const busy = uploadState === 'encrypting' || uploadState === 'uploading';
  const canUpload = !!selectedFile && password.length > 0 && !busy;

  const handleEncryptAndUpload = async () => {
    if (!selectedFile || !password) return;

    try {
      setErrorMsg(null);

      // Step 1: Encrypt in the browser
      setUploadState('encrypting');
      const arrayBuffer = await selectedFile.arrayBuffer();
      const { ciphertext, iv, salt } = await encryptFile(arrayBuffer, password);

      // Step 2: Upload only the ciphertext
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

      setFileId(result.id);
      setUploadState('done');
    } catch (err) {
      setUploadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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

  if (uploadState === 'done' && fileId && selectedFile) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-ok">
          <span className="flex size-9 items-center justify-center rounded-full bg-ok/15">
            <IconCheck />
          </span>
          <span className="font-medium">Encrypted and uploaded</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Your link is ready
        </h1>
        <p className="mt-3 max-w-xl text-steel">
          <span className="font-medium text-paper">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)}) is
          stored as scrambled data. {describeLimits(expiresIn, maxDownloads)}
        </p>

        <div className="mt-8">
          <ShareLink fileId={fileId} password={password} />
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="mt-10 rounded-md text-sm font-medium text-steel underline underline-offset-4 hover:text-paper"
        >
          Share another file
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
        Share a file only the right person can open
      </h1>
      <p className="mt-4 max-w-xl text-lg text-steel">
        Your browser encrypts the file before it uploads. The server only holds scrambled data and never sees the key.
      </p>

      <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-panel">
        <section className="p-5 sm:p-6" aria-label="File">
          <FileDropZone onFileSelected={setSelectedFile} selectedFile={selectedFile} />
        </section>

        <section className="p-5 sm:p-6" aria-label="Key">
          <PasswordInput
            password={password}
            setPassword={setPassword}
            hint="The key is added to your link. Anyone who has the whole link can open the file."
          />
        </section>

        <section className="p-5 sm:p-6" aria-label="Limits">
          <ExpirationSettings
            expiresIn={expiresIn}
            setExpiresIn={setExpiresIn}
            maxDownloads={maxDownloads}
            setMaxDownloads={setMaxDownloads}
          />
        </section>

        <section className="p-5 sm:p-6" aria-label="Upload">
          <p role="alert" className={errorMsg ? 'mb-4 flex items-start gap-2 text-sm text-alert' : 'sr-only'}>
            {errorMsg && <IconAlert className="mt-0.5 shrink-0" />}
            <span>{errorMsg}</span>
          </p>

          <button
            type="button"
            onClick={handleEncryptAndUpload}
            disabled={!canUpload}
            aria-busy={busy}
            className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-paper text-base font-semibold text-ink transition-colors enabled:hover:bg-white disabled:cursor-not-allowed disabled:bg-raised disabled:text-steel"
          >
            {uploadState === 'encrypting' ? (
              <>
                <IconSpinner />
                Encrypting in your browser…
              </>
            ) : uploadState === 'uploading' ? (
              <>
                <IconSpinner />
                Uploading…
              </>
            ) : (
              <>
                <IconLock />
                {uploadState === 'error' ? 'Try again' : 'Encrypt and upload'}
              </>
            )}
          </button>

          {!selectedFile || !password ? (
            <p className="mt-3 text-center text-sm text-steel">
              {!selectedFile ? 'Choose a file to continue.' : 'Add a key to continue.'}
            </p>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
