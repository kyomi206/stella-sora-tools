'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Bookmark } from 'lucide-react';
import {
  BuildDetailClient,
  type SlicedPotentialMeta,
} from '@/app/builds/[id]/build-detail-client';
import type { BuildRotation } from '@/lib/calculator/build-rotation';
import {
  inferSquadElement,
  type DiscRankingContext,
} from '@/lib/calculator/disc-rankings-client';
import type { CharacterCombatEntry } from '@/lib/calculator/fighter-calc';
import type { ResolvedCommunityPreset } from '@/lib/community-presets';
import { unpackAdvancedPresetCode } from '@/lib/preset-code';
import {
  getSavedPresetById,
  loadSavedPresetsFromStorage,
  savePresetsToStorage,
  updateSavedPresetRotation,
  type SavedPresetRecord,
} from '@/lib/saved-presets';
import type { SSCharacter, SSDisc, SSPotentialFull } from '@/types';

interface LoadedEngineData {
  allCharacters: Record<string, SSCharacter>;
  allCombat: Record<string, CharacterCombatEntry>;
  allDiscs: Record<string, SSDisc>;
  allPotentials: Record<string, SSPotentialFull[]>;
  buildDiscRankingContext: typeof import('@/lib/calculator/disc-rankings').buildDiscRankingContext;
}

const SKELETON_SQUAD_ROWS = [
  { key: 'vanguard', badge: 'MAIN', badgeBg: 'bg-[#ff2a70]' },
  { key: 'versatile', badge: 'SUPPORT', badgeBg: 'bg-[#6366f1]' },
  { key: 'support', badge: 'SUPPORT', badgeBg: 'bg-[#6366f1]' },
] as const;

export function LocalBuildDetailSkeleton({ title }: { title?: string }) {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div>
        <Link
          href="/builds?tab=saved"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>My Saved Builds</span>
        </Link>
      </div>

      <header className="game-card celestial-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="space-y-1 min-w-0">
            {title ? (
              <>
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="size-5.5 mt-0.5 sm:mt-1 rounded bg-surface-subtle border border-border-subtle shrink-0"
                  />
                  <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
                    {title}
                  </h1>
                </div>
                <p className="text-xs text-slate-600 dark:text-white/70">
                  Standard · Saved Squad · Local
                </p>
              </>
            ) : (
              <>
                <h1 className="sr-only">Loading Saved Build</h1>
                <div className="flex items-center gap-2 min-w-0" aria-hidden="true">
                  <span className="size-5.5 rounded bg-surface-subtle border border-border-subtle shrink-0" />
                  <div className="h-7 w-56 max-w-full rounded-md bg-surface-subtle border border-border-subtle" />
                </div>
                <div
                  aria-hidden="true"
                  className="h-4 w-40 rounded bg-surface-subtle border border-border-subtle"
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0" aria-hidden="true">
            <div className="h-8 w-28 rounded-lg bg-surface-subtle border border-border-subtle" />
            <div className="h-8 w-24 rounded-lg bg-surface-subtle border border-border-subtle" />
            <div className="h-8 w-36 rounded-lg bg-surface-subtle border border-border-subtle" />
          </div>
        </div>
      </header>

      <div
        className="inline-flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-card"
        aria-hidden="true"
      >
        <span className="px-3.5 py-1.5 rounded-lg bg-surface-subtle text-xs font-semibold text-slate-700 dark:text-white/80 whitespace-nowrap">
          Build
        </span>
        <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-white/75 whitespace-nowrap">
          Notes
        </span>
        <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-white/75 whitespace-nowrap">
          Investment &amp; Math
        </span>
      </div>

      <section className="isolate game-card celestial-card p-4 sm:p-5 space-y-4">
        <div className="border-b border-border pb-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Squad &amp; Potentials
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {SKELETON_SQUAD_ROWS.map(({ key, badge, badgeBg }) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-4 border-b border-border last:border-b-0 last:pb-0"
            >
              <div className="shrink-0 flex items-center justify-start sm:justify-center">
                <div className="relative w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg border border-border bg-surface-subtle shrink-0 overflow-hidden">
                  <div className="absolute top-1 left-1 z-10 flex items-center pointer-events-none">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-tight text-white shadow-xs ${badgeBg}`}
                    >
                      {badge}
                    </span>
                  </div>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="flex-1 min-w-0 flex flex-wrap items-end gap-2 py-1"
              >
                {[0, 1, 2, 3].map((tileIdx) => (
                  <div
                    key={tileIdx}
                    className="w-[82px] sm:w-[96px] aspect-[87/107] shrink-0 rounded-md border border-border-subtle bg-surface-subtle"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LocalBuildDetailClient() {
  const searchParams = useSearchParams();
  const recordId = searchParams.get('id') || '';
  const rawTab = searchParams.get('tab');
  const initialTab =
    rawTab === 'math' || rawTab === 'notes' || rawTab === 'build' ? rawTab : 'build';

  const [record, setRecord] = useState<SavedPresetRecord | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [engineData, setEngineData] = useState<LoadedEngineData | null>(null);

  useEffect(() => {
    const list = loadSavedPresetsFromStorage();
    setRecord(getSavedPresetById(list, recordId));
    setStorageReady(true);
  }, [recordId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('@/data/characters.json'),
      import('@/data/character-combat.json'),
      import('@/data/discs.json'),
      import('@/data/potentials-db.json'),
      import('@/lib/calculator/disc-rankings'),
    ]).then(([charsMod, combatMod, discsMod, potsMod, rankingsMod]) => {
      if (cancelled) return;
      setEngineData({
        allCharacters: charsMod.default as unknown as Record<string, SSCharacter>,
        allCombat: combatMod.default as unknown as Record<string, CharacterCombatEntry>,
        allDiscs: discsMod.default as unknown as Record<string, SSDisc>,
        allPotentials: potsMod.default as unknown as Record<string, SSPotentialFull[]>,
        buildDiscRankingContext: rankingsMod.buildDiscRankingContext,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRotationChange = useCallback(
    (next: BuildRotation | null) => {
      if (!record) return;
      const list = loadSavedPresetsFromStorage();
      const updatedList = updateSavedPresetRotation(list, record.id, next);
      savePresetsToStorage(updatedList);
      setRecord(getSavedPresetById(updatedList, record.id));
    },
    [record]
  );

  const built = useMemo(() => {
    if (!record || !engineData) return null;
    const advData = unpackAdvancedPresetCode(record.advCode);
    if (!advData) return null;

    const { allCharacters, allCombat, allDiscs, allPotentials, buildDiscRankingContext } =
      engineData;

    const element = inferSquadElement(advData, allCharacters, allDiscs);

    const trekkerNames: string[] = [];
    const characterIds: number[] = [];
    const allDiscIds: number[] = [];
    const slicedCharacters: Record<string, SSCharacter> = {};
    const slicedDiscs: Record<string, SSDisc> = {};
    const slicedPotentials: Record<string, SlicedPotentialMeta> = {};

    for (const slotKey of ['vanguard', 'versatile', 'support'] as const) {
      const slot = advData.slots[slotKey];
      if (!slot?.characterId) continue;
      const cid = slot.characterId;
      characterIds.push(cid);
      const char = allCharacters[String(cid)];
      if (char) {
        slicedCharacters[String(cid)] = char;
        trekkerNames.push(char.name.EN);
      }
      const charPots = allPotentials[String(cid)] || [];
      const byId = new Map(charPots.map((p) => [p.id, p]));
      for (const picked of slot.potentials) {
        const full = byId.get(picked.id);
        if (full) {
          slicedPotentials[String(picked.id)] = {
            id: full.id,
            name: full.name,
            rarity: full.rarity,
            isCore: full.isCore,
            descTemplate: full.descTemplate,
            params: full.params,
            characterId: full.characterId ?? cid,
          };
        }
      }
    }

    const mainDiscIds: number[] = [];
    const supportDiscIds: number[] = [];
    for (const m of advData.mainDiscs) {
      if (m.discId && allDiscs[String(m.discId)]) {
        slicedDiscs[String(m.discId)] = allDiscs[String(m.discId)];
        allDiscIds.push(m.discId);
        mainDiscIds.push(m.discId);
      }
    }
    for (const s of advData.supportDiscs) {
      if (s.discId && allDiscs[String(s.discId)]) {
        slicedDiscs[String(s.discId)] = allDiscs[String(s.discId)];
        allDiscIds.push(s.discId);
        supportDiscIds.push(s.discId);
      }
    }

    const preset: ResolvedCommunityPreset = {
      id: record.id,
      title: record.name,
      element,
      tier: 'standard',
      archetype: record.combatRotation ? 'Custom Rotation' : 'Saved Squad',
      summary: trekkerNames.length > 0 ? `${trekkerNames.join(' · ')} saved build` : 'Saved squad',
      verifiedPatch: 'Local',
      verifiedAt: new Date(record.updatedAt).toISOString().slice(0, 10),
      modes: ['general'],
      blitzIds: [],
      potentialNote: '',
      status: 'verified',
      inGameCode: record.inGameCode ?? null,
      advCode: record.advCode,
      advData,
      characterIds,
      mainDiscIds,
      supportDiscIds,
      allDiscIds,
      rotation: [],
      substitutions: [],
      sources: [],
      isStale: false,
      combatRotation: record.combatRotation ?? null,
    };

    const discRankingContext: DiscRankingContext = buildDiscRankingContext(
      preset,
      allCharacters,
      allCombat,
      allDiscs,
      allPotentials
    );

    return {
      preset,
      slicedCharacters,
      slicedDiscs,
      slicedPotentials,
      discRankingContext,
    };
  }, [record, engineData]);

  if (!storageReady || !engineData) {
    return <LocalBuildDetailSkeleton title={record?.name} />;
  }

  if (!record || !built) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <Link
          href="/builds?tab=saved"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to My Saved Builds</span>
        </Link>
        <div className="game-card celestial-card p-6 text-center space-y-3">
          <Bookmark className="size-8 mx-auto text-slate-400" aria-hidden="true" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Saved Build Not Found
          </h1>
          <p className="text-xs text-slate-600 dark:text-white/75">
            This local build was not found in browser storage. Save a community build or create a
            new squad in the Preset Builder.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/builds?tab=saved"
              className="px-3 py-1.5 rounded-lg border border-border bg-surface-card text-xs font-bold text-slate-800 dark:text-white"
            >
              View My Saved
            </Link>
            <Link
              href="/builder/advanced"
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
            >
              Open Preset Builder
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BuildDetailClient
      preset={built.preset}
      characters={built.slicedCharacters}
      discs={built.slicedDiscs}
      potentialMeta={built.slicedPotentials}
      analytics={null}
      discRankingContext={built.discRankingContext}
      isLocal
      localRecordId={record.id}
      initialTab={initialTab}
      activeRotation={record.combatRotation ?? null}
      rotationOrigin={record.combatRotation ? 'local' : 'auto'}
      onRotationChange={handleRotationChange}
    />
  );
}
