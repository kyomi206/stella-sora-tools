'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdvancedTeamBuild, SSCharacter, SSDisc } from '@/types';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import { TheoreticalDamageCalculator } from '@/components/builder/theoretical-damage-calculator';
import {
  getResolvedCommunityPresetById,
  type ResolvedCommunityPreset,
} from '@/lib/community-presets';
import { unpackAdvancedPresetCode } from '@/lib/preset-code';
import {
  loadSavedPresetsFromStorage,
  type SavedPresetRecord,
} from '@/lib/saved-presets';
import { createEmptyAdvancedBuild } from '@/lib/utils';
import { decompressAdvancedBuild } from '@/lib/share-link';
import { ArrowLeft, Calculator } from 'lucide-react';

const CHARACTERS = charactersData as Record<string, SSCharacter>;
const DISCS = discsData as Record<string, SSDisc>;

function communityPresetToAdvancedBuild(preset: ResolvedCommunityPreset): AdvancedTeamBuild {
  return {
    id: preset.id,
    name: preset.title,
    createdAt: Date.now(),
    slots: preset.advData.slots,
    mainDiscs: preset.advData.mainDiscs,
    supportDiscs: preset.advData.supportDiscs,
    targetNotes: preset.advData.targetNotes,
    ...(preset.combatRotation ? { rotation: preset.combatRotation } : {}),
  };
}

interface DamageQueryParams {
  encodedBuild: string | null;
  presetParam: string | null;
  savedParam: string | null;
  charParam: string | null;
}

function DamageQueryHydrator({
  onParamsSync,
}: {
  onParamsSync: (params: DamageQueryParams) => void;
}) {
  const searchParams = useSearchParams();
  const encodedBuild = searchParams.get('b');
  const presetParam = searchParams.get('preset');
  const savedParam = searchParams.get('saved');
  const charParam = searchParams.get('char');

  useEffect(() => {
    onParamsSync({ encodedBuild, presetParam, savedParam, charParam });
  }, [encodedBuild, presetParam, savedParam, charParam, onParamsSync]);

  return null;
}

export function DamageClient() {
  const [queryParams, setQueryParams] = useState<DamageQueryParams>({
    encodedBuild: null,
    presetParam: null,
    savedParam: null,
    charParam: null,
  });
  const { encodedBuild, presetParam, savedParam, charParam } = queryParams;
  const [build, setBuild] = useState<AdvancedTeamBuild>(createEmptyAdvancedBuild);
  const [localBuilds, setLocalBuilds] = useState<SavedPresetRecord[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState('');
  const [activePresetTitle, setActivePresetTitle] = useState('');

  useEffect(() => {
    const saved = loadSavedPresetsFromStorage();
    setLocalBuilds(saved);
    if (savedParam && !encodedBuild && !presetParam) {
      const record = saved.find((b) => b.id === savedParam);
      if (record) {
        const unpacked = unpackAdvancedPresetCode(record.advCode, CHARACTERS, DISCS);
        if (unpacked) {
          setBuild({
            id: record.id,
            name: record.name,
            createdAt: record.createdAt,
            slots: unpacked.slots,
            mainDiscs: unpacked.mainDiscs,
            supportDiscs: unpacked.supportDiscs,
            targetNotes: unpacked.targetNotes,
            ...(record.combatRotation ? { rotation: record.combatRotation } : {}),
          });
          setSelectedLocalId(record.id);
          setActivePresetTitle('');
        }
      }
    }
  }, [savedParam, encodedBuild, presetParam]);

  useEffect(() => {
    if (encodedBuild) {
      const decoded = decompressAdvancedBuild(encodedBuild, CHARACTERS, DISCS);
      if (decoded) {
        setBuild(decoded);
        setSelectedLocalId('');
        setActivePresetTitle('');
      }
      return;
    }
    if (presetParam) {
      const resolved = getResolvedCommunityPresetById(presetParam);
      if (resolved) {
        setBuild(communityPresetToAdvancedBuild(resolved));
        setSelectedLocalId('');
        setActivePresetTitle(resolved.title);
        return;
      }
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
  }, [encodedBuild, presetParam, charParam]);

  const advancedHref = encodedBuild
    ? `/builder/advanced?b=${encodedBuild}`
    : selectedLocalId
      ? `/builder/advanced?saved=${encodeURIComponent(selectedLocalId)}`
      : presetParam && activePresetTitle
        ? `/builder/advanced?community=${encodeURIComponent(presetParam)}`
        : '/builder/advanced';

  const handleSelectLocalBuild = (nextId: string) => {
    setSelectedLocalId(nextId);
    if (!nextId) return;
    const record = localBuilds.find((b) => b.id === nextId);
    if (!record) return;
    const unpacked = unpackAdvancedPresetCode(record.advCode, CHARACTERS, DISCS);
    if (!unpacked) return;
    setActivePresetTitle('');
    setBuild({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      slots: unpacked.slots,
      mainDiscs: unpacked.mainDiscs,
      supportDiscs: unpacked.supportDiscs,
      targetNotes: unpacked.targetNotes,
      ...(record.combatRotation ? { rotation: record.combatRotation } : {}),
    });
  };

  const hasLoadedBuild = Boolean(encodedBuild || activePresetTitle || selectedLocalId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
      <Suspense fallback={null}>
        <DamageQueryHydrator onParamsSync={setQueryParams} />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={advancedHref}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-surface-elevated hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 press-feedback"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to Advanced Visualizer</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">Load saved builds</span>
            <select
              value={selectedLocalId}
              onChange={(event) => handleSelectLocalBuild(event.target.value)}
              aria-label="Load saved builds"
              className="min-h-8 max-w-[16rem] rounded-lg border border-border bg-surface-card px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
            >
              <option value="">
                {localBuilds.length === 0 ? 'No saved builds' : 'Select saved build…'}
              </option>
              {localBuilds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {hasLoadedBuild && (
            <div className="hidden sm:inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Calculator className="size-3.5" aria-hidden="true" />
              <span className="max-w-[16rem] truncate">{build.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">
        {hasLoadedBuild ? (
          <>
            <span>
              Synced build:{' '}
              <strong className="font-semibold text-slate-900 dark:text-white">{build.name}</strong>{' '}
              — Trekkers, Runic Discs, and Musical Notes loaded.
            </span>
            <Link
              href={advancedHref}
              className="inline-flex min-h-7 items-center font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 dark:text-teal-400 dark:hover:text-teal-700"
            >
              Edit in Advanced Visualizer
            </Link>
          </>
        ) : charParam && CHARACTERS[charParam] ? (
          <>
            <span>
              Starter slot loaded for{' '}
              <strong className="font-semibold text-slate-900 dark:text-white">
                {CHARACTERS[charParam].name.EN}
              </strong>
              . Pick discs below or configure a full squad in the Advanced Visualizer.
            </span>
            <Link
              href="/builder/advanced"
              className="inline-flex min-h-7 items-center font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 dark:text-teal-400 dark:hover:text-teal-700"
            >
              Open Advanced Visualizer
            </Link>
          </>
        ) : (
          <>
            <span>
              No build loaded. Pick a saved local build above or open one from the Advanced Visualizer to sync its Trekkers,
              Runic Discs, and Musical Notes.
            </span>
            <Link
              href="/builder/advanced"
              className="inline-flex min-h-7 items-center font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 dark:text-teal-400 dark:hover:text-teal-700"
            >
              Open Advanced Visualizer
            </Link>
          </>
        )}
      </div>

      <TheoreticalDamageCalculator
        build={build}
        characters={CHARACTERS}
        discs={DISCS}
      />
    </div>
  );
}
