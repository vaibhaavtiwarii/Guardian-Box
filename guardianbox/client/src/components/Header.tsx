export default function Header() {
  return (
    <header className="w-full py-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            >
              <path
                d="M20 2L4 10V20C4 30.5 11 36.5 20 38C29 36.5 36 30.5 36 20V10L20 2Z"
                fill="url(#shield-gradient)"
                stroke="#6366f1"
                strokeWidth="1.5"
              />
              <path
                d="M20 8L10 13V20C10 27 14.5 31.5 20 33C25.5 31.5 30 27 30 20V13L20 8Z"
                fill="#0a0a0f"
                fillOpacity="0.6"
              />
              <path
                d="M17 20L19 22L24 17"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient
                  id="shield-gradient"
                  x1="4"
                  y1="2"
                  x2="36"
                  y2="38"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </svg>
            {/* Glow ring */}
            <div className="absolute -inset-1 rounded-full bg-[#6366f1]/20 blur-md -z-10" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="text-[var(--gb-text)]">Guardian</span>
            <span className="text-[var(--gb-primary)]">Box</span>
          </h1>
        </div>
        <p className="text-sm text-[var(--gb-text-muted)] tracking-wide uppercase font-medium">
          Zero-Knowledge Encrypted File Sharing
        </p>
      </div>
    </header>
  );
}
