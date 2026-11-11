import type { Metadata } from 'next';
import { ShieldCheck, HeartHandshake, Layers } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Credits — Stella Sora Tools',
  description:
    'Attributions, data sources, assets, and technology stack powering Stella Sora Tools.',
};

export default function CreditsPage() {
  const assetCredits = [
    {
      title: 'Stella Sora (sprites, characters, icons, audio, and game data)',
      author: 'Yostar, Inc.',
      url: 'https://stellasora.yostar.net/',
    },
    {
      title: 'StellaDB',
      author: 'AutumnVN',
      url: 'https://github.com/AutumnVN/stelladb',
    },
    {
      title: 'Imported Data',
      author: 'StellaSoraData',
      url: 'https://github.com/Hiro420/StellaSoraData',
    },
    {
      title: 'Damage Formula',
      author: 'AutumnVN',
      url: 'https://gist.github.com/AutumnVN/91afd7a37a9743488419b70f07225950',
    },
    {
      title: 'Miraheze Community Wiki',
      author: 'Stella Sora Wiki Contributors',
      url: 'https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki',
    },
    {
      title: 'Noya Team Builder',
      author: 'Noya',
      url: 'https://noyanoya.vercel.app/',
    },
    {
      title: 'Lucide Icons',
      author: 'Lucide Contributors',
      url: 'https://lucide.dev/',
    },
    {
      title: '"Geist" & "Geist Mono" Typefaces',
      author: 'Vercel, Inc.',
      url: 'https://vercel.com/font',
    },
  ];

  const techStack = [
    {
      name: 'Next.js 16',
      role: 'React Framework (Turbopack, App Router, React 19)',
      url: 'https://nextjs.org/',
      icon: (
        <svg viewBox="0 0 180 180" fill="none" className="size-8 text-slate-900">
          <circle cx="90" cy="90" r="87" stroke="currentColor" strokeWidth="6" />
          <path
            d="M149.5 157.5L69.1 54H54v72h12.1V69.4l73.9 95.4c3.3-2.2 6.5-4.6 9.5-7.3z"
            fill="currentColor"
          />
          <rect x="115" y="54" width="12" height="72" fill="currentColor" />
        </svg>
      ),
    },
    {
      name: 'Tailwind CSS v4',
      role: 'Utility-First Styling Engine',
      url: 'https://tailwindcss.com/',
      icon: (
        <svg viewBox="0 0 54 33" fill="none" className="size-8 text-sky-600">
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"
          />
        </svg>
      ),
    },
    {
      name: 'React 19',
      role: 'Component Architecture & Server Prerender',
      url: 'https://react.dev/',
      icon: (
        <svg viewBox="-11.5 -10.23174 23 20.46348" className="size-8 text-[#58c4dc]">
          <circle cx="0" cy="0" r="2.05" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1" fill="none">
            <ellipse rx="11" ry="4.2" />
            <ellipse rx="11" ry="4.2" transform="rotate(60)" />
            <ellipse rx="11" ry="4.2" transform="rotate(120)" />
          </g>
        </svg>
      ),
    },
    {
      name: 'TypeScript',
      role: 'Type Safety & Domain Model Schemas',
      url: 'https://www.typescriptlang.org/',
      icon: (
        <svg viewBox="0 0 128 128" className="size-8">
          <rect width="128" height="128" rx="16" fill="#3178c6" />
          <path
            d="M57.9 69.3v-5.2H42.7V42.5h-7.6V85h7.6V69.3h15.2zm27.6-11.8c-2.4-1.8-5.4-2.8-8.9-2.8-3.4 0-6.1.9-8 2.6-1.9 1.7-2.9 4-2.9 6.8 0 2.4.8 4.4 2.5 5.9 1.7 1.5 4.4 2.8 8.1 3.9 3.8 1.1 6.5 2.5 8.1 4.1 1.6 1.6 2.4 3.7 2.4 6.3 0 3.3-1.3 6-3.8 8-2.5 2-6.1 3-10.7 3-3.5 0-6.8-.7-9.8-2.2-3-1.5-5.2-3.6-6.6-6.3l6.5-4c1.1 1.9 2.5 3.3 4.2 4.3 1.7 1 3.7 1.5 5.9 1.5 2.5 0 4.5-.6 6-1.8 1.5-1.2 2.2-2.8 2.2-4.8 0-1.9-.7-3.4-2.2-4.6-1.5-1.1-3.9-2.2-7.3-3.2-4.2-1.3-7.3-2.9-9.2-4.7-1.9-1.8-2.9-4.3-2.9-7.3 0-3.3 1.2-6 3.6-8 2.4-2 5.7-3 10-3 3.1 0 5.9.6 8.4 1.8 2.5 1.2 4.4 2.9 5.8 5.1l-6.2 4.5z"
            fill="#ffffff"
          />
        </svg>
      ),
    },
    {
      name: 'html2canvas-pro',
      role: 'Client-Side Preset Card Rasterization & PNG Export',
      url: 'https://github.com/niklasvh/html2canvas',
      icon: (
        <div className="size-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-mono font-bold text-xs">
          PNG
        </div>
      ),
    },
    {
      name: 'lz-string',
      role: 'URI Compression for Preset Sharing Links',
      url: 'https://github.com/pieroxy/lz-string',
      icon: (
        <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-mono font-bold text-xs">
          LZ
        </div>
      ),
    },
    {
      name: 'Vercel',
      role: 'Global Edge Network Hosting & CI/CD Pipeline',
      url: 'https://vercel.com/',
      icon: (
        <svg viewBox="0 0 256 222" className="size-8 text-slate-900">
          <path fill="currentColor" d="M128 0L256 221.7H0z" />
        </svg>
      ),
    },
    {
      name: 'Lucide React',
      role: 'Minimalist Icon Library',
      url: 'https://lucide.dev/',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-8"
          id="lucide-logo"
        >
          <path
            d="M14 12C14 9.79086 12.2091 8 10 8C7.79086 8 6 9.79086 6 12C6 16.4183 9.58172 20 14 20C18.4183 20 22 16.4183 22 12C22 8.446 20.455 5.25285 18 3.05557"
            className="stroke-slate-900 dark:stroke-white"
          />
          <path
            d="M10 12C10 14.2091 11.7909 16 14 16C16.2091 16 18 14.2091 18 12C18 7.58172 14.4183 4 10 4C5.58172 4 2 7.58172 2 12C2 15.5841 3.57127 18.8012 6.06253 21"
            stroke="#F56565"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border-subtle pb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
          <HeartHandshake className="size-4" aria-hidden="true" />
          <span>Attributions &amp; Sources</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
          Credits
        </h1>
      </div>

      {/* 1. Assets & Community Data */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Layers className="size-4 text-slate-600" aria-hidden="true" />
          <h2>Assets &amp; Community Data</h2>
        </div>

        <div className="rounded-xl border border-border bg-surface-card celestial-card divide-y divide-border-subtle overflow-hidden">
          {assetCredits.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-elevated transition-colors group press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="font-medium text-sm text-slate-900 group-hover:text-slate-900 transition-colors">
                {item.title}
              </span>
              <span className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors shrink-0">
                {item.author}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 2. Tech Stack */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <ShieldCheck className="size-4 text-slate-600" aria-hidden="true" />
          <h2>Tech Stack &amp; Frameworks</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {techStack.map((tech) => (
            <a
              key={tech.name}
              href={tech.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl border border-border bg-surface-card celestial-card hover:border-border-hover hover:bg-surface-elevated transition-colors duration-150 flex items-center gap-3 group press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="shrink-0 flex items-center justify-center" aria-hidden="true">
                {tech.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-900 transition-colors">
                  {tech.name}
                </h3>
                <p className="text-xs text-slate-600 truncate">
                  {tech.role}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 3. Disclaimer & Notice */}
      <section className="p-4 rounded-xl border border-border-subtle bg-base text-xs text-slate-600 leading-relaxed space-y-2">
        <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">
          Disclaimer &amp; Fair Use Notice
        </h3>
        <p>
          Stella Sora Tools is an unofficial fan-created platform. It is not affiliated with, endorsed, sponsored, or specifically approved by Yostar, Inc. All game content, artwork, characters, audio, trademarks, and intellectual property remain the sole property of their respective owners.
        </p>
        <p>
          This site uses Vercel Web Analytics, which sets no cookies.
        </p>
      </section>
    </div>
  );
}
