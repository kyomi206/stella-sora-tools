import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-border-subtle py-6 px-4 sm:px-6 frosted-panel text-xs text-slate-500">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <p className="font-medium text-slate-700">
            Stella Sora Tools: Unofficial Fan Companion
          </p>
          <p className="text-slate-500">
            Stella Sora and all related assets, characters, and trademarks are property of Yostar.
          </p>
        </div>

        <nav aria-label="Footer links" className="flex items-center gap-3 text-slate-600">
          <Link
            href="/credits"
            className="hover:underline hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Credits
          </Link>
          <span className="w-px h-3 bg-border" aria-hidden="true" />
          <a
            href="https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Miraheze Wiki
          </a>
          <span className="w-px h-3 bg-border" aria-hidden="true" />
          <a
            href="https://noyanoya.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            Noya Builder
          </a>
          <span className="w-px h-3 bg-border" aria-hidden="true" />
          <a
            href="https://github.com/Hiro420/StellaSoraData"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1"
          >
            StellaSoraData
          </a>
        </nav>
      </div>
    </footer>
  );
}
