'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Disc, Search, X } from 'lucide-react';
import { MUSICAL_NOTES, getDiscOutfitIconUrl, getNoteIconUrl } from '@/data/notes';
import {
  getAllDiscTags,
  getAllDiscs,
  getDiscRequiredHarmonyNotes,
  getDiscSlug,
  getDiscSupportNotesAtPhase,
} from '@/lib/discs';
import { cn } from '@/lib/utils';
import { RarityStars } from '@/components/ui/rarity-stars';

interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  customContent?: React.ReactNode;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  isOpen: boolean;
  onOpenToggle: () => void;
  onToggle: (value: string) => void;
  onClear: () => void;
  activeClass: string;
  inactiveClass: string;
}

function FilterDropdown({
  label,
  options,
  selected,
  isOpen,
  onOpenToggle,
  onToggle,
  onClear,
  activeClass,
  inactiveClass,
}: FilterDropdownProps) {
  const hasSelection = selected.length > 0;
  const selectedText =
    selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpenToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-medium press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
          hasSelection ? activeClass : inactiveClass
        )}
      >
        <span>
          {hasSelection
            ? selected.length === 1
              ? `${label}: ${selectedText}`
              : `${label} (${selectedText})`
            : label}
        </span>
        <ChevronDown
          className={cn('size-3.5 transition-transform duration-150', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute left-0 top-full mt-1.5 z-40 min-w-[205px] max-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-white dark:bg-[#0f172a] shadow-lg p-1.5 space-y-0.5"
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => onToggle(opt.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer',
                  checked
                    ? 'bg-amber-500/15 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#1e293b]'
                )}
              >
                <span
                  className={cn(
                    'size-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                    checked
                      ? 'bg-amber-500 border-amber-600 text-slate-950'
                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                  )}
                >
                  {checked && <Check className="size-2.5 stroke-[3]" />}
                </span>
                {opt.icon && (
                  <img
                    src={opt.icon}
                    alt=""
                    aria-hidden="true"
                    className="size-3.5 object-contain shrink-0"
                  />
                )}
                {opt.customContent ?? <span className="truncate">{opt.label}</span>}
              </button>
            );
          })}
          <div className="border-t border-border-subtle pt-1 mt-1">
            <button
              type="button"
              onClick={onClear}
              disabled={!hasSelection}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                hasSelection
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer'
                  : 'text-slate-400 dark:text-white/35 cursor-not-allowed'
              )}
            >
              <X className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type DiscSortKey = 'rarity' | 'atk' | 'name';

export function DiscsClient() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<DiscSortKey>('rarity');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedGivesNotes, setSelectedGivesNotes] = useState<string[]>([]);
  const [selectedNeedsNotes, setSelectedNeedsNotes] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const allDiscs = useMemo(() => getAllDiscs(), []);
  const allTags = useMemo(() => getAllDiscTags(), []);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filterConfigs = useMemo(() => {
    const noteOptions: FilterOption[] = MUSICAL_NOTES.map((n) => ({
      value: n.name,
      label: n.shortName,
      icon: getNoteIconUrl(n.id),
    }));

    return [
      {
        id: 'element',
        label: 'Element',
        selected: selectedElements,
        setter: setSelectedElements,
        options: [
          ...['Ignis', 'Aqua', 'Terra', 'Ventus', 'Lux', 'Umbra'].map((el) => ({
            value: el,
            label: el,
            icon: `/ss-element/${el}.webp`,
          })),
          { value: 'None', label: 'Neutral' },
        ],
      },
      {
        id: 'rarity',
        label: 'Rarity',
        selected: selectedRarities,
        setter: setSelectedRarities,
        options: [5, 4, 3].map((star) => ({
          value: String(star),
          label: `${star}-Star`,
          customContent: <RarityStars count={star} size="sm" />,
        })),
      },
      {
        id: 'tags',
        label: 'Tags',
        selected: selectedTags,
        setter: setSelectedTags,
        options: allTags.map((t) => ({ value: t, label: t })),
      },
      {
        id: 'givesNotes',
        label: 'Gives Support Note',
        selected: selectedGivesNotes,
        setter: setSelectedGivesNotes,
        options: noteOptions,
      },
      {
        id: 'needsNotes',
        label: 'Needs Harmony Note',
        selected: selectedNeedsNotes,
        setter: setSelectedNeedsNotes,
        options: noteOptions,
      },
    ];
  }, [
    allTags,
    selectedElements,
    selectedRarities,
    selectedTags,
    selectedGivesNotes,
    selectedNeedsNotes,
  ]);

  const toggleItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const filteredDiscs = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = allDiscs.filter((disc) => {
      if (q) {
        const haystack = [
          disc.name,
          disc.element === 'None' ? 'Neutral' : disc.element,
          ...(disc.tag || []),
          ...(disc.char || []),
          disc.mainSkill?.name || '',
          disc.mainSkill?.desc || '',
          disc.secondarySkill1?.name || '',
          disc.secondarySkill1?.desc || '',
          disc.secondarySkill2?.name || '',
          disc.secondarySkill2?.desc || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (selectedElements.length > 0 && !selectedElements.includes(disc.element)) {
        return false;
      }

      if (selectedRarities.length > 0 && !selectedRarities.includes(String(disc.star))) {
        return false;
      }

      if (
        selectedTags.length > 0 &&
        !selectedTags.some((tag) => (disc.tag || []).includes(tag))
      ) {
        return false;
      }

      if (selectedGivesNotes.length > 0) {
        const maxSupNotes = getDiscSupportNotesAtPhase(disc, 9);
        if (!selectedGivesNotes.some((n) => (maxSupNotes[n] || 0) > 0)) {
          return false;
        }
      }

      if (selectedNeedsNotes.length > 0) {
        const reqNotes = getDiscRequiredHarmonyNotes(disc);
        if (!selectedNeedsNotes.some((n) => reqNotes.includes(n as never))) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'atk') {
        const atkDiff = Number(b.stats?.lv90?.ATK ?? 0) - Number(a.stats?.lv90?.ATK ?? 0);
        if (atkDiff !== 0) return atkDiff;
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (b.star !== a.star) return b.star - a.star;
      const atkDiff = Number(b.stats?.lv90?.ATK ?? 0) - Number(a.stats?.lv90?.ATK ?? 0);
      if (atkDiff !== 0) return atkDiff;
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [
    allDiscs,
    search,
    sortBy,
    selectedElements,
    selectedRarities,
    selectedTags,
    selectedGivesNotes,
    selectedNeedsNotes,
  ]);

  const ACTIVE_CHIP_STYLE =
    'bg-amber-500 text-slate-950 border-amber-600 font-semibold shadow-xs';
  const INACTIVE_CHIP_STYLE =
    'bg-base text-slate-600 dark:text-white/90 border-border-subtle hover:text-slate-900 dark:hover:text-white hover:border-border-hover';

  const hasActiveFilters =
    Boolean(search) ||
    selectedElements.length > 0 ||
    selectedRarities.length > 0 ||
    selectedTags.length > 0 ||
    selectedGivesNotes.length > 0 ||
    selectedNeedsNotes.length > 0;

  const handleClearFilters = () => {
    setSearch('');
    setSelectedElements([]);
    setSelectedRarities([]);
    setSelectedTags([]);
    setSelectedGivesNotes([]);
    setSelectedNeedsNotes([]);
    setSortBy('rarity');
    setOpenDropdown(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border-subtle pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Runic Disc Encyclopedia
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/75">
          Browse all {allDiscs.length} Runic Discs in Stella Sora. Filter by element, tags, or Musical Notes and click any disc to inspect its Melody Skill, Harmony skills, and Support Notes.
        </p>
      </div>

      {/* Filter, Search, and Sort Bar */}
      <div className="relative z-30 p-4 game-card celestial-card overflow-visible flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/70"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search Runic Discs by name, skill effect, tag, or Trekker…"
              aria-label="Search Runic Discs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suppressHydrationWarning
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-base border border-border-subtle text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/45 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="disc-sort-select"
              className="text-xs font-medium text-slate-600 dark:text-white/75"
            >
              Sort
            </label>
            <select
              id="disc-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as DiscSortKey)}
              className="px-2.5 py-2 rounded-lg bg-base dark:bg-[#0f172a] border border-border-subtle text-xs font-medium text-slate-900 dark:text-white/90 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="rarity">Rarity (5-Star to 3-Star)</option>
              <option value="atk">Max ATK (Lv.90)</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        <div ref={dropdownContainerRef} className="flex flex-wrap items-center gap-2 text-xs">
          {filterConfigs.map((cfg) => (
            <FilterDropdown
              key={cfg.id}
              label={cfg.label}
              options={cfg.options}
              selected={cfg.selected}
              isOpen={openDropdown === cfg.id}
              onOpenToggle={() =>
                setOpenDropdown((prev) => (prev === cfg.id ? null : cfg.id))
              }
              onToggle={(val) => toggleItem(cfg.setter, val)}
              onClear={() => cfg.setter([])}
              activeClass={ACTIVE_CHIP_STYLE}
              inactiveClass={INACTIVE_CHIP_STYLE}
            />
          ))}
        </div>

        {hasActiveFilters && (
          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-subtle bg-base text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white hover:border-border-hover text-xs font-medium transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-xs text-slate-600 dark:text-white/75 flex items-center justify-between">
        <span>
          Showing <strong className="text-slate-900 dark:text-white tabular-nums">{filteredDiscs.length}</strong> of{' '}
          <span className="tabular-nums">{allDiscs.length}</span> Runic Discs
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-xs font-medium cursor-pointer transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Discs Grid or Empty State */}
      {filteredDiscs.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3 game-card celestial-card p-8">
          <div className="size-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Search className="size-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No Runic Discs Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-white/75 max-w-sm">
            No Runic Discs match the current filters. Try adjusting or resetting your search criteria.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-2 px-3.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredDiscs.map((disc, index) => {
            const isFiveStar = disc.star >= 5;
            const isFourStar = disc.star === 4;

            return (
              <Link
                key={disc.id}
                href={`/discs/${getDiscSlug(disc.name)}`}
                title={`View ${disc.name} details`}
                aria-label={`${disc.name}, ${disc.star}-Star ${disc.element === 'None' ? 'Neutral' : disc.element} Runic Disc`}
                className={cn(
                  'group relative w-full aspect-[3.8/4.2] rounded-xl overflow-hidden bg-surface-card select-none transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg block press-feedback focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer hover:border-border-hover',
                  isFiveStar
                    ? 'border-2 border-purple-400/45 shadow-md shadow-purple-500/10'
                    : isFourStar
                    ? 'border-2 border-amber-400/45 shadow-sm'
                    : 'border-2 border-sky-400/40 shadow-sm'
                )}
              >
                {/* Top Rarity Bar */}
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 h-0.5 z-20',
                    isFiveStar
                      ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
                      : isFourStar
                      ? 'bg-[#fde047]'
                      : 'bg-[#7dd3fc]'
                  )}
                />

                {/* Top Dark Gradient Overlay */}
                <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-black/65 via-black/25 to-transparent pointer-events-none z-10" />

                {/* Top-Left Element Badge */}
                <div className="absolute top-1 left-1 z-20 pointer-events-none">
                  {disc.element !== 'None' ? (
                    <img
                      src={`/ss-element/${disc.element}.webp`}
                      alt={disc.element}
                      width={32}
                      height={32}
                      className="size-7 sm:size-8 object-contain drop-shadow-md"
                    />
                  ) : (
                    <span
                      title="Neutral"
                      className="flex size-7 items-center justify-center rounded-full bg-slate-900/75 border border-white/25 text-slate-200 shadow-sm"
                    >
                      <Disc className="size-4" aria-hidden="true" />
                    </span>
                  )}
                </div>

                {/* Full-Bleed Disc Artwork */}
                <img
                  src={getDiscOutfitIconUrl(disc.id, 'full')}
                  alt={disc.name}
                  width={240}
                  height={265}
                  loading={index >= 8 ? 'lazy' : undefined}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Bottom Dark Gradient Fade */}
                <div className="absolute inset-x-0 bottom-1.5 h-16 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-10" />

                {/* Disc Name & Rarity Stars */}
                <div className="absolute bottom-2 inset-x-2 z-20 flex items-end justify-between gap-1.5 pointer-events-none">
                  <span className="font-bold text-xs sm:text-sm text-white tracking-tight leading-tight drop-shadow line-clamp-2">
                    {disc.name}
                  </span>
                  <RarityStars count={disc.star} size="sm" />
                </div>

                {/* Bottom Rarity Bar */}
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 h-1.5 z-20',
                    isFiveStar
                      ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                      : isFourStar
                      ? 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
                      : 'bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0ea5e9] border-t border-sky-200/50'
                  )}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
