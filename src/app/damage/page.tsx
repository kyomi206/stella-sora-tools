'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdvancedTeamBuild, SSCharacter, SSDisc } from '@/types';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import { TheoreticalDamageCalculator } from '@/components/builder/theoretical-damage-calculator';
import { createEmptyAdvancedBuild } from '@/lib/utils';
import { decompressAdvancedBuild } from '@/lib/share-link';
import { ArrowLeft, Calculator, Construction } from 'lucide-react';

function DamageCalculatorContent() {
  const searchParams = useSearchParams();
  const encodedBuild = searchParams.get('b');
  const [build, setBuild] = useState<AdvancedTeamBuild>(createEmptyAdvancedBuild);

  const characters = charactersData as Record<string, SSCharacter>;
  const discs = discsData as Record<string, SSDisc>;

  const charParam = searchParams.get('char');

  useEffect(() => {
    if (encodedBuild) {
      const decoded = decompressAdvancedBuild(encodedBuild, characters, discs);
      if (decoded) setBuild(decoded);
      return;
    }
    if (charParam && characters[charParam]) {
      setBuild((prev) => ({
        ...prev,
        slots: {
          ...prev.slots,
          vanguard: { ...prev.slots.vanguard, characterId: Number(charParam) },
        },
      }));
    }
  }, [encodedBuild, charParam, characters]);

  const advancedHref = encodedBuild
    ? `/builder/advanced?b=${encodedBuild}`
    : '/builder/advanced';

  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={advancedHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to Advanced Visualizer</span>
          </Link>

          {encodedBuild && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-subtle text-xs font-semibold text-slate-700 dark:text-white/80">
              <Calculator className="size-3.5" aria-hidden="true" />
              <span className="max-w-[16rem] truncate">{build.name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center text-center p-8 sm:p-14 rounded-2xl border border-border bg-surface-card shadow-xs min-h-[380px]">
          <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <Construction className="size-7" aria-hidden="true" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-3">
            Under Development
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Theoretical Damage Calculator
          </h1>

          <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            This tool is currently under development. Please check back later!
          </p>

          <Link
            href={advancedHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold shadow-xs transition-colors press-feedback"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Return to Advanced Visualizer</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={advancedHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to Advanced Visualizer</span>
        </Link>

        {encodedBuild && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-subtle text-xs font-semibold text-slate-700 dark:text-white/80">
            <Calculator className="size-3.5" aria-hidden="true" />
            <span className="max-w-[16rem] truncate">{build.name}</span>
          </div>
        )}
      </div>

      {!encodedBuild && (
        <p className="text-xs text-slate-500 dark:text-white/60">
          No preset loaded. Open a preset from the Advanced Visualizer to sync its
          Trekkers, Runic Discs, and Musical Notes.
        </p>
      )}

      <TheoreticalDamageCalculator
        build={build}
        characters={characters}
        discs={discs}
      />
    </div>
  );
}

export default function DamageCalculatorPage() {
  const isDev = process.env.NODE_ENV === 'development';
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-slate-600">
          {isDev ? 'Loading Theoretical Damage Calculator…' : 'Loading…'}
        </div>
      }
    >
      <DamageCalculatorContent />
    </Suspense>
  );
}
