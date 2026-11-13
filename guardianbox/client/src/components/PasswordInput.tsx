import { useState } from 'react';
import { generatePassword } from '../utils/cryptoUtils';

interface PasswordInputProps {
  password: string;
  setPassword: (password: string) => void;
  label?: string;
}

export default function PasswordInput({ password, setPassword, label = 'Encryption Key' }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleGenerateKey = () => {
    const key = generatePassword(32);
    setPassword(key);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-[var(--gb-text-muted)] mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a strong password or generate one"
            className="
              w-full px-4 py-3 pr-12 rounded-xl
              bg-[var(--gb-surface)] border border-[var(--gb-border)]
              text-[var(--gb-text)] placeholder-[var(--gb-text-muted)]/50
              focus:outline-none focus:border-[var(--gb-primary)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
              transition-all duration-200
              font-mono text-sm
            "
          />
          {/* Show/hide toggle */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              text-[var(--gb-text-muted)] hover:text-[var(--gb-text)]
              transition-colors duration-200
            "
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerateKey}
          className="
            px-4 py-3 rounded-xl
            bg-[var(--gb-surface)] border border-[var(--gb-border)]
            text-[var(--gb-text-muted)] hover:text-[var(--gb-accent)] hover:border-[var(--gb-accent)]/50
            transition-all duration-200
            flex items-center gap-2 whitespace-nowrap text-sm font-medium
            hover:shadow-[0_0_12px_rgba(34,211,238,0.1)]
          "
          title="Generate Random Key"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="hidden sm:inline">Generate Key</span>
        </button>
      </div>
    </div>
  );
}
