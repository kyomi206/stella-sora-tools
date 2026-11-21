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
import { ArrowLeft, Calculator } from 'lucide-react';

const CHARACTERS = charactersData as Record<string, SSCharacter>;
const DISCS = discsData as Record<string, SSDisc>;

function DamageCalculatorContent() {
  const searchParams = useSearchParams();
  const encodedBuild = searchParams.get('b');
  const charParam = searchParams.get('char');
  const [build, setBuild] = useState<AdvancedTeamBuild>(createEmptyAdvancedBuild);

  useEffect(() => {
    if (encodedBuild) {
      const decoded = decompressAdvancedBuild(encodedBuild, CHARACTERS, DISCS);
      if (decoded) setBuild(decoded);
      return;
    }
    if (charParam && CHARACTERS[charParam]) {
      setBuild((prev) => ({
        ...prev,
        slots: {
          ...prev.slots,
          vanguard: { ...prev.slots.vanguard, characterId: Number(charParam) },
        },
      }));
    }
  }, [encodedBuild, charParam]);

  const advancedHref = encodedBuild
    ? `/builder/advanced?b=${encodedBuild}`
    : '/builder/advanced';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={advancedHref}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-surface-elevated hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 press-feedback"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to Advanced Visualizer</span>
        </Link>

        {encodedBuild && (
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Calculator className="size-3.5" aria-hidden="true" />
            <span className="max-w-[16rem] truncate">{build.name}</span>
          </div>
        )}
      </div>

      {!encodedBuild && !charParam && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">
          <span>
            No preset loaded. Open a preset from the Advanced Visualizer to sync its Trekkers,
            Runic Discs, and Musical Notes.
          </span>
          <Link
            href="/builder/advanced"
            className="inline-flex min-h-7 items-center font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 dark:hover:text-teal-600"
          >
            Open Advanced Visualizer
          </Link>
        </div>
      )}

      <TheoreticalDamageCalculator
        build={build}
        characters={CHARACTERS}
        discs={DISCS}
      />
    </div>
  );
}

export function DamageClient() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-slate-600 dark:text-slate-400">
          Loading Team Damage Calculator…
        </div>
      }
    >
      <DamageCalculatorContent />
    </Suspense>
  );
}
