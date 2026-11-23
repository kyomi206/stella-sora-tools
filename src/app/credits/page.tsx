import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/json-ld';
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Credits',
  description:
    'Attributions, community data sources, game asset disclaimers, and technology stack powering KiyoStella.',
  path: '/credits',
});

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
  ];

  const techStack = [
    {
      name: 'Next.js 16',
      role: 'React Framework (Turbopack, App Router, React 19)',
      url: 'https://nextjs.org/',
    },
    {
      name: 'Tailwind CSS v4',
      role: 'Utility-First Styling Engine',
      url: 'https://tailwindcss.com/',
    },
    {
      name: 'React 19',
      role: 'Component Architecture & Server Prerender',
      url: 'https://react.dev/',
    },
    {
      name: 'TypeScript',
      role: 'Type Safety & Domain Model Schemas',
      url: 'https://www.typescriptlang.org/',
    },
    {
      name: 'html2canvas-pro',
      role: 'Client-Side Preset Card Rasterization & PNG Export',
      url: 'https://github.com/niklasvh/html2canvas',
    },
    {
      name: 'lz-string',
      role: 'URI Compression for Preset Sharing Links',
      url: 'https://github.com/pieroxy/lz-string',
    },
    {
      name: 'Vercel',
      role: 'Global Edge Network Hosting & CI/CD Pipeline',
      url: 'https://vercel.com/',
    },
    {
      name: 'Lucide React',
      role: 'Minimalist Icon Library',
      url: 'https://lucide.dev/',
    },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto px-4 py-8">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Credits & Attributions', path: '/credits' },
        ])}
      />
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border-subtle pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Credits
        </h1>
      </div>

      {/* 1. Assets & Community Data */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          Assets &amp; Community Data
        </h2>

        <div className="rounded-xl border border-border bg-surface-card celestial-card divide-y divide-border-subtle overflow-hidden">
          {assetCredits.map((item) => (
            <a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-surface-elevated transition-colors group press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
        <h2 className="text-base font-semibold text-slate-900">
          Tech Stack &amp; Frameworks
        </h2>

        <div className="rounded-xl border border-border bg-surface-card celestial-card divide-y divide-border-subtle overflow-hidden">
          {techStack.map((tech) => (
            <a
              key={tech.name}
              href={tech.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 hover:bg-surface-elevated transition-colors group press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="font-medium text-sm text-slate-900 shrink-0">
                {tech.name}
              </span>
              <span className="text-xs text-slate-600 sm:text-right">
                {tech.role}
              </span>
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
