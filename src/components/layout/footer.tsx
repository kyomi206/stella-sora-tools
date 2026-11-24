import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-border-subtle py-6 px-4 sm:px-6 bg-surface-subtle text-xs text-slate-600 dark:text-slate-400">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <p className="font-medium text-slate-700">
            Stella Sora Tools v0.1.1
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Stella Sora and all related assets, characters, and trademarks are property of Yostar.
          </p>
        </div>

        <nav aria-label="Footer links" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-slate-600 dark:text-slate-400">
          <Link
            href="/feedback"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Feedback
          </Link>
          <Link
            href="/credits"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Credits
          </Link>
          <a
            href="https://github.com/kyomi206/stella-sora-tools"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Website
          </a>
          <a
            href="https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Miraheze Wiki
          </a>
          <a
            href="https://noyanoya.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Noya Builder
          </a>
          <a
            href="https://github.com/Hiro420/StellaSoraData"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            StellaSoraData
          </a>
        </nav>
      </div>
    </footer>
  );
}
