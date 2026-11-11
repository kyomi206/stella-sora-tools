import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center text-center p-8 sm:p-14 rounded-2xl border border-border bg-surface-card shadow-xs min-h-[380px]">
        <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
          <FileQuestion className="size-7" aria-hidden="true" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-3">
          404 Not Found
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Page Not Found
        </h1>

        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition-colors press-feedback"
        >
          <Home className="size-4" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
