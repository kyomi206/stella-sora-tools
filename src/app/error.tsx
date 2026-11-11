'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center text-center p-8 sm:p-14 rounded-2xl border border-border bg-surface-card shadow-xs min-h-[380px]">
        <div className="size-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-3">
          Error
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Something went wrong
        </h1>

        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          An unexpected error occurred while loading this page.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition-colors press-feedback cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>Try again</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
          >
            <Home className="size-4" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
