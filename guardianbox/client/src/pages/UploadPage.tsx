import { useState } from 'react';
import Shell from '../components/Shell';
import FileDropZone from '../components/FileDropZone';
import PasswordInput from '../components/PasswordInput';
import ExpirationSettings from '../components/ExpirationSettings';
import ShareLink from '../components/ShareLink';
import HeroArt from '../components/HeroArt';
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
        <div className="rounded-[28px] border border-white/10 bg-panel p-6 sm:p-10">
          <div className="flex items-center gap-3 text-safe">
            <span className="flex size-9 items-center justify-center rounded-full bg-safe/15">
              <IconCheck />
            </span>
            <span className="font-medium">Encrypted and uploaded</span>
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-none tracking-tight sm:text-6xl">Your link is ready</h1>
          <p className="mt-4 max-w-xl text-steel">
            <span className="font-medium text-paper">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)}) is
            stored as scrambled data. {describeLimits(expiresIn, maxDownloads)}
          </p>

          <div className="mt-8">
            <ShareLink fileId={fileId} password={password} />
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-10 rounded-full text-sm font-medium text-steel underline underline-offset-4 hover:text-paper"
          >
            Share another file
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell wide>
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-paper">
            <span className="size-2 rounded-full bg-safe" aria-hidden="true" />
            Zero-knowledge file sharing
          </p>
          <h1 className="mt-6 text-[2.75rem] font-bold leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.25rem]">
            Share files only the right person can open
          </h1>
          <p className="mt-6 max-w-lg text-lg text-steel">
            Your browser locks the file before it uploads. The server only holds scrambled data and never sees the key.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#share"
              className="inline-flex h-14 items-center rounded-full bg-paper px-8 font-semibold text-ink hover:bg-white"
            >
              Share a file
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-14 items-center rounded-full border border-white/20 px-8 font-medium text-paper hover:border-white/50"
            >
              How it works
            </a>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-6">
            <div>
              <dd className="text-3xl font-bold tracking-tight sm:text-4xl">256-bit</dd>
              <dt className="mt-1 text-sm text-steel">AES-GCM encryption</dt>
            </div>
            <div>
              <dd className="text-3xl font-bold tracking-tight text-safe sm:text-4xl">0</dd>
              <dt className="mt-1 text-sm text-steel">keys the server receives</dt>
            </div>
            <div>
              <dd className="text-3xl font-bold tracking-tight sm:text-4xl">600k</dd>
              <dt className="mt-1 text-sm text-steel">key-stretching rounds</dt>
            </div>
          </dl>
        </div>
        <HeroArt />
      </section>

      {/* Tool */}
      <section id="share" className="mt-20 rounded-[28px] border border-white/10 bg-panel p-5 sm:mt-28 sm:p-8" aria-label="Share a file">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Share a file</h2>
          <p className="inline-flex items-center gap-2 rounded-full border border-safe/30 bg-safe/10 px-4 py-1.5 text-sm text-safe">
            <IconLock width={16} height={16} />
            Encrypted in your browser
          </p>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <div className="space-y-6">
            <FileDropZone onFileSelected={setSelectedFile} selectedFile={selectedFile} />
            <PasswordInput
              password={password}
              setPassword={setPassword}
              hint="The key is added to your link. Anyone who has the whole link can open the file."
            />
          </div>

          <div className="flex flex-col justify-between gap-8 rounded-3xl bg-ink/60 p-5 sm:p-6">
            <ExpirationSettings
              expiresIn={expiresIn}
              setExpiresIn={setExpiresIn}
              maxDownloads={maxDownloads}
              setMaxDownloads={setMaxDownloads}
            />

            <div>
              <p role="alert" className={errorMsg ? 'mb-4 flex items-start gap-2 text-sm text-alert' : 'sr-only'}>
                {errorMsg && <IconAlert className="mt-0.5 shrink-0" />}
                <span>{errorMsg}</span>
              </p>

              <button
                type="button"
                onClick={handleEncryptAndUpload}
                disabled={!canUpload}
                aria-busy={busy}
                className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-paper text-base font-semibold text-ink transition-colors enabled:hover:bg-white disabled:cursor-not-allowed disabled:bg-raised disabled:text-steel"
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
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mt-24 sm:mt-32">
        <h2 className="max-w-2xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
          Three moves, and the server is never in the room
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: 1,
              title: 'Your browser locks the file',
              body: 'The key you choose is stretched 600,000 times, then used to encrypt the file with AES-256-GCM on your device.',
              extra: (
                <p className="mt-6 rounded-2xl bg-ink px-4 py-3 font-mono text-xs text-steel">
                  report.pdf <span className="ml-2 rounded-full bg-safe/15 px-2 py-0.5 text-safe">locked</span>
                </p>
              ),
            },
            {
              n: 2,
              title: 'The server keeps scrambled data',
              body: 'Only the encrypted bytes are uploaded. This is all the storage bucket ever holds:',
              extra: (
                <p className="mt-6 break-all rounded-2xl bg-ink px-4 py-3 font-mono text-xs leading-6 text-safe/80">
                  b25fc53a 7adcb628 919b1fc4 e03d57a1 0c9e44f2
                </p>
              ),
            },
            {
              n: 3,
              title: 'The key travels in the link',
              body: 'It sits after the # in the address, and browsers never send that part to a server.',
              extra: (
                <p className="mt-6 break-all rounded-2xl bg-ink px-4 py-3 font-mono text-xs leading-6">
                  <span className="text-steel">/file/9f2c…</span>
                  <span className="text-steel/60">#</span>
                  <span className="text-key">your-key</span>
                </p>
              ),
            },
          ].map((step) => (
            <li key={step.n} className="rounded-[28px] border border-white/10 bg-panel p-6 sm:p-7">
              <span className="flex size-10 items-center justify-center rounded-full bg-paper text-sm font-bold text-ink">
                {step.n}
              </span>
              <h3 className="mt-5 text-xl font-semibold leading-snug">{step.title}</h3>
              <p className="mt-2 text-steel">{step.body}</p>
              {step.extra}
            </li>
          ))}
        </ol>
      </section>

      {/* What the server sees */}
      <section id="server-view" className="mt-24 sm:mt-32">
        <h2 className="max-w-2xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
          What the server can and can't see
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-panel p-7">
            <h3 className="text-xl font-semibold">It can see</h3>
            <ul className="mt-4 space-y-3 text-steel">
              {['When you uploaded', 'File size, name and type', 'Your IP address, like any website', 'The encrypted bytes'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="size-2 shrink-0 rounded-full bg-steel" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-safe p-7 text-ink">
            <h3 className="text-xl font-bold">It can't see</h3>
            <ul className="mt-4 space-y-3 font-medium">
              {['What is inside your file', 'The key after the #', 'The decrypted file, ever'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-safe" aria-hidden="true">
                    <IconCheck width={12} height={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </Shell>
  );
}
