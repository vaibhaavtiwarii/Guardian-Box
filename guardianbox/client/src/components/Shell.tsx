import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './icons';

const GITHUB = 'https://github.com/vaibhaavtiwarii/Guardian-Box';

export default function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const width = wide ? 'max-w-6xl' : 'max-w-4xl';
  return (
    <div className="ambient relative flex min-h-screen flex-col">
      <div className="dots pointer-events-none absolute inset-x-0 top-0 h-[44rem]" aria-hidden="true" />

      <header className={`sticky top-3 z-20 mx-auto mt-3 w-full px-3 sm:top-4 sm:mt-4 sm:px-5 ${width}`}>
        <nav
          aria-label="Main"
          className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/70 py-2 pl-5 pr-2 backdrop-blur-md"
        >
          <Link to="/" className="inline-flex items-center gap-2.5 rounded-full text-paper" aria-label="GuardianBox home">
            <Logo />
            <span className="text-lg font-bold tracking-tight">GuardianBox</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/#how-it-works" className="hidden rounded-full px-4 py-2 text-sm text-steel hover:text-paper md:inline-block">
              How it works
            </a>
            <a href="/#server-view" className="hidden rounded-full px-4 py-2 text-sm text-steel hover:text-paper md:inline-block">
              What the server sees
            </a>
            <a href={GITHUB} className="hidden rounded-full px-4 py-2 text-sm text-steel hover:text-paper sm:inline-block">
              Source
            </a>
            <a
              href="/#share"
              className="inline-flex h-10 items-center rounded-full bg-paper px-5 text-sm font-semibold text-ink hover:bg-white"
            >
              Share a file
            </a>
          </div>
        </nav>
      </header>

      <main className={`relative z-10 mx-auto w-full flex-1 px-5 pb-20 pt-10 sm:pt-14 ${width}`}>{children}</main>

      <footer className={`relative z-10 mx-auto w-full px-5 pb-8 text-sm text-steel ${width}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <p>Files are encrypted with AES-256-GCM before they leave your device.</p>
          <a href={GITHUB} className="rounded-full underline underline-offset-4 hover:text-paper">
            Read the source
          </a>
        </div>
      </footer>
    </div>
  );
}
