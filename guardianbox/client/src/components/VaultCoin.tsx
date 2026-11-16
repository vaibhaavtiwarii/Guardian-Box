import { useId } from 'react';

type Glyph = 'shield' | 'lock' | 'hash';

/** A glowing "vault coin": the visual shorthand for an encrypted file. */
export default function VaultCoin({ glyph = 'shield', className = '' }: { glyph?: Glyph; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  const text = 'ZERO KNOWLEDGE  •  AES-256-GCM  •  END TO END  •  ';

  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${uid}-face`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="0.55" stopColor="#0f0f0f" />
          <stop offset="1" stopColor="#050505" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd37a" />
          <stop offset="0.45" stopColor="#ff9a12" />
          <stop offset="1" stopColor="#8a3a00" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <path id={`${uid}-circle`} d="M120 120 m-82 0 a82 82 0 1 1 164 0 a82 82 0 1 1 -164 0" />
      </defs>

      {/* glow */}
      <circle cx="120" cy="120" r="108" fill="none" stroke="#ff8a00" strokeWidth="10" opacity="0.75" filter={`url(#${uid}-glow)`} />
      {/* body */}
      <circle cx="120" cy="120" r="110" fill={`url(#${uid}-face)`} />
      <circle cx="120" cy="120" r="108" fill="none" stroke={`url(#${uid}-rim)`} strokeWidth="3" />
      <circle cx="120" cy="120" r="101" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
      {/* edge ticks */}
      <g stroke="#ff9a12" strokeOpacity="0.55" strokeWidth="1.2">
        {ticks.map((i) => (
          <line key={i} x1="120" y1="12" x2="120" y2={i % 6 === 0 ? 22 : 17} transform={`rotate(${i * 5} 120 120)`} />
        ))}
      </g>
      {/* lettering */}
      <text fontFamily="'IBM Plex Mono', monospace" fontSize="10.5" letterSpacing="2.4" fill="#f4f4f1" fillOpacity="0.8">
        <textPath href={`#${uid}-circle`}>{text}</textPath>
      </text>
      <circle cx="120" cy="120" r="64" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
      <circle cx="120" cy="120" r="58" fill="none" stroke="#ff9a12" strokeOpacity="0.35" strokeDasharray="2 5" />

      {/* centre symbol */}
      <g fill="none" stroke="#ffb13b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {glyph === 'shield' && (
          <>
            <path d="M120 86 L152 98 V122 C152 142 138 154 120 162 C102 154 88 142 88 122 V98 Z" />
            <circle cx="120" cy="118" r="7" fill="#ffb13b" stroke="none" />
            <path d="M120 124 V140" />
          </>
        )}
        {glyph === 'lock' && (
          <>
            <rect x="92" y="114" width="56" height="42" rx="9" />
            <path d="M102 114 V104 a18 18 0 0 1 36 0 V114" />
            <circle cx="120" cy="134" r="5" fill="#ffb13b" stroke="none" />
          </>
        )}
        {glyph === 'hash' && (
          <>
            <path d="M108 88 L100 152 M140 88 L132 152 M90 106 H152 M88 134 H150" />
          </>
        )}
      </g>
      {/* highlight */}
      <path d="M44 84 A88 88 0 0 1 120 32" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
