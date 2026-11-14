import { useId, useState } from 'react';
import { generatePassword } from '../utils/cryptoUtils';
import { IconEye, IconEyeOff, IconKey } from './icons';

interface PasswordInputProps {
  password: string;
  setPassword: (password: string) => void;
  label?: string;
  hint?: string;
  showGenerate?: boolean;
}

export default function PasswordInput({
  password,
  setPassword,
  label = 'Encryption key',
  hint,
  showGenerate = true,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const id = useId();
  const hintId = `${id}-hint`;

  const handleGenerateKey = () => {
    setPassword(generatePassword(32));
    setShowPassword(true); // reveal it so the person can see what was created
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <input
            id={id}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Type a passphrase or generate a key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={hint ? hintId : undefined}
            className={`h-12 w-full rounded-lg border border-line bg-ink px-4 pr-12 font-mono text-sm placeholder:font-sans placeholder:text-steel/70 focus:border-steel ${
              showPassword && password ? 'text-key' : 'text-paper'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-steel hover:text-paper"
            aria-label={showPassword ? 'Hide key' : 'Show key'}
            aria-pressed={showPassword}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        {showGenerate && (
          <button
            type="button"
            onClick={handleGenerateKey}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm font-medium hover:border-steel"
          >
            <IconKey className="text-key" />
            Generate key
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-steel">
          {hint}
        </p>
      )}
    </div>
  );
}
