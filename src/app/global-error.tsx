'use client';

import { useEffect } from 'react';
import './globals.css';
import { RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex items-center justify-center game-gradient-bg text-slate-900 font-sans p-4">
        <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-border bg-surface-card min-h-[320px] max-w-lg w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h1>

          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            A critical error occurred while running the application.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold transition-colors press-feedback cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <span>Try again</span>
            </button>

            <a
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-border bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-slate-900 dark:text-white transition-colors press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Home className="size-4" aria-hidden="true" />
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
