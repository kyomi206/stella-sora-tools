import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import charactersData from '@/data/characters.json';

/**
 * Generate static paths for all 41 Trekkers in the local dataset.
 * Supports canonical English names, URL-encoded names, and numeric IDs.
 */
export function generateStaticParams() {
  const list = Object.values(charactersData);
  const params: { name: string }[] = [];
  for (const c of list) {
    params.push({ name: c.name.EN });
    if (c.name.EN.includes(' ')) {
      params.push({ name: encodeURIComponent(c.name.EN) });
    }
    params.push({ name: String(c.id) });
  }
  return params;
}

interface TrekkerPageProps {
  params: Promise<{ name: string }>;
}

export default async function TrekkerPage(props: TrekkerPageProps) {
  const { name } = await props.params;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/trekkers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to Trekker Encyclopedia</span>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center p-8 sm:p-14 rounded-2xl border border-border bg-surface-card shadow-xs min-h-[380px]">
          <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <Construction className="size-7" aria-hidden="true" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-3">
            Under Development
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Trekker Encyclopedia Dossier
          </h1>

          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Individual Trekker dossiers are currently under development. Please check back later!
          </p>

          <Link
            href="/trekkers"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition-colors press-feedback"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Return to Trekker Encyclopedia</span>
          </Link>
        </div>
      </div>
    );
  }

  const { default: TrekkerDetailClient } = await import('./trekker-detail-client');

  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="game-card celestial-card p-8 inline-block max-w-sm w-full animate-pulse">
            <div className="size-12 rounded-full bg-surface-elevated border border-border-subtle mx-auto mb-3" />
            <div className="h-5 bg-surface-elevated border border-border-subtle rounded w-32 mx-auto mb-2" />
            <div className="h-3 bg-surface-elevated border border-border-subtle rounded w-48 mx-auto" />
          </div>
        </div>
      }
    >
      <TrekkerDetailClient name={name} />
      {/* 
        Companion Quick Action Navigation contracts:
        - /builder?char=${char.id}
        - /damage?char=${char.id}
        - /bond?char=${char.id}
        - https://stellasora.miraheze.org/wiki/${name}
        Offline Data Stores:
        - @/data/character-combat.json
        - @/data/potentials-db.json
      */}
    </Suspense>
  );
}
