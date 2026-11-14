import { useState } from 'react';
import { IconAlert, IconCheck, IconCopy } from './icons';

interface ShareLinkProps {
  fileId: string;
  password: string;
}

export default function ShareLink({ fileId, password }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const address = `${window.location.origin}/file/${fileId}`;
  // Percent-encode so passphrases with spaces or non-English characters survive the round trip.
  const key = encodeURIComponent(password);
  const shareUrl = `${address}#${key}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for browsers without the async clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      {/* The link, split into what the server sees and what stays in the browser */}
      <div className="rounded-xl border border-line bg-ink p-4 sm:p-5">
        <p className="break-all font-mono text-[13px] leading-7 sm:text-sm">
          <span className="text-steel">{address}</span>
          <span className="text-steel/60">#</span>
          <span className="key-seal rounded px-0.5 text-key">{key}</span>
        </p>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2 sm:gap-6">
          <div className="flex gap-3">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-steel" aria-hidden="true" />
            <div>
              <dt className="font-medium">Address</dt>
              <dd className="text-steel">The server sees this part, so it can find your file.</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-key" aria-hidden="true" />
            <div>
              <dt className="font-medium">Key, after the #</dt>
              <dd className="text-steel">Your browser never sends this part to the server.</dd>
            </div>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-paper px-5 font-semibold text-ink hover:bg-white sm:w-auto"
      >
        {copied ? <IconCheck /> : <IconCopy />}
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>

      <p className="mt-6 flex items-start gap-3 text-sm text-steel">
        <IconAlert className="mt-0.5 shrink-0 text-key" />
        <span>
          <strong className="font-semibold text-paper">Save this link now.</strong> The key exists only
          in the link. If it is lost, the file can't be recovered, not even by us.
        </span>
      </p>
    </div>
  );
}
