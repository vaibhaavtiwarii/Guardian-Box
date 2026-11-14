import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './icons';

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-3xl px-5 pt-6 sm:pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-md py-1 text-paper"
          aria-label="GuardianBox home"
        >
          <Logo />
          <span className="text-lg font-semibold tracking-tight">GuardianBox</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-10 sm:pt-14">{children}</main>

      <footer className="mx-auto w-full max-w-3xl px-5 pb-8 text-sm text-steel">
        <p>
          Files are encrypted with AES-256-GCM before they leave your device.{' '}
          <a
            href="https://github.com/vaibhaavtiwarii/Guardian-Box"
            className="rounded underline underline-offset-4 hover:text-paper"
          >
            Read the source
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
