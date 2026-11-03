'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdvancedTeamBuild, SSCharacter, SSDisc } from '@/types';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import { TheoreticalDamageCalculator } from '@/components/builder/theoretical-damage-calculator';
import {
  decompressAdvancedBuild,
  createEmptyAdvancedBuild,
} from '@/lib/utils';
import { ArrowLeft, Calculator } from 'lucide-react';

function DamageCalculatorContent() {
  const searchParams = useSearchParams();
  const encodedBuild = searchParams.get('b');
  const [build, setBuild] = useState<AdvancedTeamBuild>(createEmptyAdvancedBuild);

  const characters = charactersData as Record<string, SSCharacter>;
  const discs = discsData as Record<string, SSDisc>;

  useEffect(() => {
    if (!encodedBuild) return;
    const decoded = decompressAdvancedBuild(encodedBuild);
    if (decoded) setBuild(decoded);
  }, [encodedBuild]);

  const advancedHref = encodedBuild
    ? `/builder/advanced?b=${encodedBuild}`
    : '/builder/advanced';

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
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-slate-600">
          Loading Theoretical Damage Calculator…
        </div>
      }
    >
      <DamageCalculatorContent />
    </Suspense>
  );
}
