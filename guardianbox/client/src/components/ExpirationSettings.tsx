import { useId } from 'react';
import { EXPIRY_OPTIONS, DOWNLOAD_OPTIONS } from '../utils/format';

interface ExpirationSettingsProps {
  expiresIn: number | null;
  setExpiresIn: (value: number | null) => void;
  maxDownloads: number | null;
  setMaxDownloads: (value: number | null) => void;
}

interface ChipGroupProps {
  legend: string;
  options: { label: string; value: number | null }[];
  value: number | null;
  onChange: (value: number | null) => void;
}

function ChipGroup({ legend, options, value, onChange }: ChipGroupProps) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt.label} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              className="peer sr-only"
              checked={opt.value === value}
              onChange={() => onChange(opt.value)}
            />
            <span className="flex min-h-11 items-center rounded-lg border border-line bg-ink px-4 text-sm transition-colors hover:border-steel peer-checked:border-paper peer-checked:bg-paper peer-checked:font-medium peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ExpirationSettings({
  expiresIn,
  setExpiresIn,
  maxDownloads,
  setMaxDownloads,
}: ExpirationSettingsProps) {
  return (
    <div className="space-y-5">
      <ChipGroup legend="Expires after" options={EXPIRY_OPTIONS} value={expiresIn} onChange={setExpiresIn} />
      <ChipGroup
        legend="Download limit"
        options={DOWNLOAD_OPTIONS}
        value={maxDownloads}
        onChange={setMaxDownloads}
      />
      <p className="text-sm text-steel">
        The file is deleted from the server as soon as either limit is reached.
      </p>
    </div>
  );
}
