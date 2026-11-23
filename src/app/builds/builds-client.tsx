'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Bookmark,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { CommunityPresetCard } from '@/components/builder/community-preset-card';
import { hasActiveRotationEntries } from '@/lib/calculator/build-rotation';
import type { ResolvedCommunityPreset } from '@/lib/community-presets';
import { unpackAdvancedPresetCode } from '@/lib/preset-code';
import {
  deleteSavedPreset,
  duplicateSavedPreset,
  loadSavedPresetsFromStorage,
  savePresetsToStorage,
  type SavedPresetRecord,
} from '@/lib/saved-presets';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { ElementType, SSCharacter, SSDisc } from '@/types';

const ELEMENT_FILTERS: ReadonlyArray<'all' | ElementType> = [
  'all',
  'Ignis',
  'Aqua',
  'Terra',
  'Ventus',
  'Umbra',
  'Lux',
];

export interface BuildsClientProps {
  presets: ResolvedCommunityPreset[];
  characters: Record<string, SSCharacter>;
  discs: Record<string, SSDisc>;
  analyticsPresetIds: string[];
}

function matchesSearchQuery(
  preset: ResolvedCommunityPreset,
  query: string,
  characters: Record<string, SSCharacter>,
  discs: Record<string, SSDisc>
): boolean {
  if (!query) return true;
  if (
    preset.title.toLowerCase().includes(query) ||
    preset.summary.toLowerCase().includes(query) ||
    preset.archetype.toLowerCase().includes(query)
  ) {
    return true;
  }

  for (const cid of preset.characterIds) {
    const ch = characters[String(cid)];
    if (
      ch &&
      [ch.name.EN, ch.name.JP, ch.name.CN, ch.name.KR, ch.name.TW]
        .filter(Boolean)
        .some((n) => n!.toLowerCase().includes(query))
    ) {
      return true;
    }
  }

  for (const did of preset.allDiscIds) {
    const disc = discs[String(did)];
    if (disc?.name.toLowerCase().includes(query)) return true;
  }

  return false;
}

function BuildsQuerySync({
  onTabSync,
}: {
  onTabSync: (tab: 'public' | 'saved') => void;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    onTabSync(tabParam === 'saved' ? 'saved' : 'public');
  }, [tabParam, onTabSync]);

  return null;
}

export function BuildsClient({
  presets,
  characters,
  discs,
  analyticsPresetIds,
}: BuildsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeHubTab, setActiveHubTab] = useState<'public' | 'saved'>('public');

  const [savedRecords, setSavedRecords] = useState<SavedPresetRecord[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [elementFilter, setElementFilter] = useState<'all' | ElementType>('all');
  const [trekkerFilter, setTrekkerFilter] = useState<number | null>(null);
  const [trekkerPickerOpen, setTrekkerPickerOpen] = useState(false);
  const [trekkerSearch, setTrekkerSearch] = useState('');

  useEffect(() => {
    setSavedRecords(loadSavedPresetsFromStorage());
  }, [activeHubTab]);

  const setHubTab = (tab: 'public' | 'saved') => {
    setActiveHubTab(tab);
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    if (tab === 'saved') {
      params.set('tab', 'saved');
    } else {
      params.delete('tab');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleDuplicateSaved = (id: string) => {
    const res = duplicateSavedPreset(loadSavedPresetsFromStorage(), id);
    if (res.duplicated && savePresetsToStorage(res.list)) {
      setSavedRecords(res.list);
    }
  };

  const handleDeleteSaved = (id: string) => {
    const next = deleteSavedPreset(loadSavedPresetsFromStorage(), id);
    if (savePresetsToStorage(next)) {
      setSavedRecords(next);
      setConfirmDeleteId(null);
    }
  };

  const filteredSavedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return savedRecords;
    return savedRecords.filter((record) => {
      if (record.name.toLowerCase().includes(q)) return true;
      const unpacked = unpackAdvancedPresetCode(record.advCode);
      if (!unpacked) return false;
      return (['vanguard', 'versatile', 'support'] as const).some((slot) => {
        const cid = unpacked.slots[slot]?.characterId;
        const ch = cid ? characters[String(cid)] : undefined;
        return ch
          ? [ch.name.EN, ch.name.JP, ch.name.CN, ch.name.KR, ch.name.TW]
              .filter(Boolean)
              .some((n) => n!.toLowerCase().includes(q))
          : false;
      });
    });
  }, [savedRecords, search, characters]);

  const pickerRef = useRef<HTMLDivElement | null>(null);
  const analyticsSet = useMemo(() => new Set(analyticsPresetIds), [analyticsPresetIds]);

  useEffect(() => {
    if (!trekkerPickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setTrekkerPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTrekkerPickerOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [trekkerPickerOpen]);

  const hasActiveFilters =
    search.trim().length > 0 || elementFilter !== 'all' || trekkerFilter !== null;

  const resetFilters = () => {
    setSearch('');
    setElementFilter('all');
    setTrekkerFilter(null);
    setTrekkerSearch('');
    setTrekkerPickerOpen(false);
  };

  // Unique Trekkers present across presets, sorted by name
  const availableTrekkers = useMemo(() => {
    const counts = new Map<number, number>();
    for (const preset of presets) {
      for (const cid of new Set(preset.characterIds)) {
        counts.set(cid, (counts.get(cid) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ char: characters[String(id)], count }))
      .filter((entry): entry is { char: SSCharacter; count: number } => Boolean(entry.char))
      .sort((a, b) => a.char.name.EN.localeCompare(b.char.name.EN));
  }, [presets, characters]);

  const filteredPickerTrekkers = useMemo(() => {
    const q = trekkerSearch.trim().toLowerCase();
    if (!q) return availableTrekkers;
    return availableTrekkers.filter(({ char }) =>
      [char.name.EN, char.name.JP, char.name.CN, char.name.KR, char.name.TW]
        .filter(Boolean)
        .some((n) => n!.toLowerCase().includes(q))
    );
  }, [availableTrekkers, trekkerSearch]);

  // Pre-element filtered list so element pills show live counts for current search + Trekker
  const presetsMatchingSearchAndTrekker = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter((preset) => {
      if (trekkerFilter !== null && !preset.characterIds.includes(trekkerFilter)) return false;
      return matchesSearchQuery(preset, q, characters, discs);
    });
  }, [presets, search, trekkerFilter, characters, discs]);

  const elementCounts = useMemo(() => {
    const counts: Record<string, number> = { all: presetsMatchingSearchAndTrekker.length };
    for (const preset of presetsMatchingSearchAndTrekker) {
      counts[preset.element] = (counts[preset.element] || 0) + 1;
    }
    return counts;
  }, [presetsMatchingSearchAndTrekker]);

  const filteredPresets = useMemo(() => {
    if (elementFilter === 'all') return presetsMatchingSearchAndTrekker;
    return presetsMatchingSearchAndTrekker.filter((preset) => preset.element === elementFilter);
  }, [presetsMatchingSearchAndTrekker, elementFilter]);

  const selectedTrekker = trekkerFilter !== null ? characters[String(trekkerFilter)] || null : null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4">
      <Suspense fallback={null}>
        <BuildsQuerySync onTabSync={setActiveHubTab} />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Community Builds
        </h1>
      </div>

      {/* Public Builds vs My Saved Hub Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Builds hub sections"
          className="inline-flex items-center p-1 rounded-xl border border-border bg-surface-subtle"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeHubTab === 'public'}
            onClick={() => setHubTab('public')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              activeHubTab === 'public'
                ? 'bg-surface-card text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            Public Builds ({presets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeHubTab === 'saved'}
            onClick={() => setHubTab('saved')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              activeHubTab === 'saved'
                ? 'bg-surface-card text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            My Saved ({savedRecords.length})
          </button>
        </div>

        <Link
          href="/builder/advanced"
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          New Build in Builder
        </Link>
      </div>

      {activeHubTab === 'saved' ? (
        savedRecords.length === 0 ? (
          <div className="game-card celestial-card p-10 text-center space-y-3">
            <Bookmark className="size-8 mx-auto text-slate-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              No Saved Builds Yet
            </h2>
            <p className="text-xs text-slate-600 dark:text-white/75 max-w-md mx-auto">
              Save any public build to customize its skill rotation, or create a new squad in the
              Preset Builder.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHubTab('public')}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface-card text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
              >
                Browse Public Builds
              </button>
              <Link
                href="/builder/advanced"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Open Preset Builder
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="game-card celestial-card p-3 sm:p-3.5">
              <div className="relative">
                <Search
                  className="size-3.5 text-slate-600 dark:text-white/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search saved builds or Trekker…"
                  aria-label="Search saved builds"
                  className="w-full rounded-lg border border-border bg-base pl-8.5 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear saved builds search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {filteredSavedRecords.length === 0 ? (
              <div className="game-card celestial-card p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  No saved builds match &ldquo;{search}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="px-3 py-1 rounded-lg border border-border bg-surface-card text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSavedRecords.map((record) => {
              const unpacked = unpackAdvancedPresetCode(record.advCode);
              const slotIds = (['vanguard', 'versatile', 'support'] as const)
                .map((s) => unpacked?.slots[s]?.characterId ?? null)
                .filter((id): id is number => id !== null);
              const hasCustomRotation = hasActiveRotationEntries(record.combatRotation);
              const isConfirmingDelete = confirmDeleteId === record.id;
              return (
                <article
                  key={record.id}
                  className="game-card celestial-card p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/builds/local?id=${encodeURIComponent(record.id)}&tab=math`}
                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline line-clamp-1"
                      >
                        {record.name}
                      </Link>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 rounded-full border text-xs font-semibold',
                          hasCustomRotation
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'border-teal-500/35 bg-teal-500/10 text-teal-800 dark:text-teal-300'
                        )}
                      >
                        {hasCustomRotation ? 'Custom Rotation' : 'Auto-Estimated'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {slotIds.map((cid) => {
                        const ch = characters[String(cid)];
                        return (
                          <div
                            key={cid}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border-subtle bg-surface-subtle/70 text-xs"
                          >
                            {ch && (
                              <img
                                src={getTrekkerImageUrl(ch.id)}
                                alt={ch.name.EN}
                                width={20}
                                height={20}
                                className="size-5 rounded object-cover"
                              />
                            )}
                            <span className="font-medium text-slate-800 dark:text-white/90 truncate max-w-[85px]">
                              {ch?.name.EN ?? `#${cid}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/builds/local?id=${encodeURIComponent(record.id)}&tab=math`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold"
                      >
                        <BarChart3 className="size-3" aria-hidden="true" />
                        <span>Investment Math</span>
                      </Link>
                      <Link
                        href={`/builder/advanced?saved=${encodeURIComponent(record.id)}`}
                        className="px-2 py-1 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/90"
                      >
                        Edit
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Duplicate ${record.name}`}
                        onClick={() => handleDuplicateSaved(record.id)}
                        className="size-7 rounded-lg border border-border bg-surface-card hover:bg-surface-hover flex items-center justify-center text-slate-600 dark:text-white/80 cursor-pointer"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </button>
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSaved(record.id)}
                            className="h-7 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-7 px-2 rounded-lg border border-border bg-surface-card text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete ${record.name}`}
                          onClick={() => setConfirmDeleteId(record.id)}
                          className="size-7 rounded-lg border border-border bg-surface-card hover:bg-rose-500/15 flex items-center justify-center text-slate-600 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
            )}
          </div>
        )
      ) : (
        <>

      {/* Compact Single Filter Bar */}
      <section
        aria-label="Filter community builds"
        className="game-card celestial-card p-3 sm:p-3.5 space-y-2.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="size-3.5 text-slate-600 dark:text-white/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search build or Trekker…"
              aria-label="Search community builds"
              className="w-full rounded-lg border border-border bg-base pl-8.5 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear build search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Trekker Picker Dropdown */}
          <div ref={pickerRef} className="relative">
            {selectedTrekker ? (
              <div className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-lg border border-amber-500/60 bg-amber-500/12 text-xs font-semibold text-slate-900 dark:text-white">
                <button
                  type="button"
                  onClick={() => setTrekkerPickerOpen((v) => !v)}
                  aria-expanded={trekkerPickerOpen}
                  className="inline-flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                >
                  <img
                    src={getTrekkerImageUrl(selectedTrekker.id)}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 rounded object-cover object-top"
                  />
                  <span>{selectedTrekker.name.EN}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrekkerFilter(null);
                    setTrekkerPickerOpen(false);
                  }}
                  aria-label={`Clear ${selectedTrekker.name.EN} filter`}
                  className="size-5 inline-flex items-center justify-center rounded hover:bg-surface-hover text-slate-600 dark:text-white/75 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTrekkerPickerOpen((v) => !v)}
                aria-expanded={trekkerPickerOpen}
                aria-haspopup="listbox"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <UserPlus className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>Trekker</span>
                <ChevronDown className="size-3 text-slate-500 dark:text-white/60" aria-hidden="true" />
              </button>
            )}

            {trekkerPickerOpen && (
              <div
                role="dialog"
                aria-label="Filter by Trekker"
                className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-40 w-64 rounded-xl border border-border bg-surface-card shadow-2xl p-2 space-y-2"
              >
                <div className="relative">
                  <Search
                    className="size-3.5 text-slate-500 dark:text-white/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={trekkerSearch}
                    onChange={(e) => setTrekkerSearch(e.target.value)}
                    placeholder="Find Trekker…"
                    aria-label="Filter Trekkers list"
                    autoFocus
                    className="w-full rounded-lg border border-border bg-base pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>

                <div
                  role="listbox"
                  aria-label="Trekkers"
                  className="scrollbar-thin max-h-60 overflow-y-auto overscroll-contain space-y-0.5"
                >
                  {filteredPickerTrekkers.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-600 dark:text-white/70">
                      No matching Trekkers
                    </div>
                  ) : (
                    filteredPickerTrekkers.map(({ char, count }) => {
                      const isSelected = trekkerFilter === char.id;
                      return (
                        <button
                          key={char.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setTrekkerFilter(isSelected ? null : char.id);
                            setTrekkerPickerOpen(false);
                            setTrekkerSearch('');
                          }}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left',
                            isSelected
                              ? 'bg-amber-500/20 text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-white/90 hover:bg-surface-hover'
                          )}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <img
                              src={getTrekkerImageUrl(char.id)}
                              alt=""
                              width={24}
                              height={24}
                              loading="lazy"
                              decoding="async"
                              className="size-6 rounded-md object-cover object-top border border-border shrink-0"
                            />
                            <span className="truncate">{char.name.EN}</span>
                          </span>
                          <span className="text-[11px] tabular-nums text-slate-500 dark:text-white/60 shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}

          {/* Count + Subtle Submit Link */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span
              data-testid="builds-count-badge"
              className="px-2 py-0.5 rounded-md border border-border bg-surface-elevated text-xs tabular-nums font-bold text-slate-700 dark:text-white/85"
            >
              {hasActiveFilters
                ? `${filteredPresets.length} / ${presets.length}`
                : `${presets.length} builds`}
            </span>

            <a
              href="https://github.com/kyomi206/stella-sora-tools/issues/new?template=community-build.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-sky-700 dark:text-sky-400 transition-colors press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>Submit Build</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Element Pills with Live Counts */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter by element"
        >
          {ELEMENT_FILTERS.map((el) => {
            const count = elementCounts[el] || 0;
            const active = elementFilter === el;
            return (
              <button
                key={el}
                type="button"
                aria-pressed={active}
                onClick={() => setElementFilter(el)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  active
                    ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold'
                    : count === 0
                      ? 'bg-surface-subtle border-border-subtle text-slate-500 dark:text-white/40 hover:bg-surface-hover'
                      : 'bg-surface-card border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                )}
              >
                {el !== 'all' && (
                  <img
                    src={`/ss-element/${el}.webp`}
                    alt=""
                    width={14}
                    height={14}
                    className="size-3.5 object-contain"
                  />
                )}
                <span>{el === 'all' ? 'All' : el}</span>
                <span
                  className={cn(
                    'text-[11px] tabular-nums',
                    active ? 'text-slate-950/80' : 'text-slate-500 dark:text-white/55'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3-Column Visual Card Grid or Empty State */}
      {filteredPresets.length === 0 ? (
        <div className="game-card celestial-card p-10 text-center space-y-3">
          <Layers className="size-7 mx-auto text-slate-500 dark:text-white/55" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            No matching builds
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Show All {presets.length}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPresets.map((preset) => (
            <CommunityPresetCard
              key={preset.id}
              preset={preset}
              characters={characters}
              discs={discs}
              hasAnalytics={analyticsSet.has(preset.id)}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
