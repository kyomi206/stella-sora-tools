'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import charactersData from '@/data/characters.json';
import trekkerLoreData from '@/data/trekker-lore.json';
import { SSCharacter } from '@/types';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';

interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  darkIconInLightMode?: boolean;
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
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
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
          className="absolute left-0 top-full mt-1.5 z-40 min-w-[190px] max-h-64 overflow-y-auto rounded-lg border border-border-subtle bg-white dark:bg-[#0f172a] shadow-lg p-1.5 space-y-0.5"
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
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e293b]'
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
                    className={cn(
                      'size-3.5 object-contain shrink-0',
                      opt.darkIconInLightMode && 'brightness-0 dark:brightness-100'
                    )}
                  />
                )}
                <span className="truncate">{opt.label}</span>
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
                  : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
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

export default function TrekkersPage() {
  const [search, setSearch] = useState('');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCombatTypes, setSelectedCombatTypes] = useState<string[]>([]);
  const [selectedFactions, setSelectedFactions] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const characters = charactersData as Record<string, SSCharacter>;
  const loreMap = trekkerLoreData as Record<string, { style?: string; faction?: string }>;

  const charList = useMemo(() => Object.values(characters), [characters]);

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

  const elementOptions: FilterOption[] = useMemo(
    () =>
      ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Umbra', 'Lux'].map((el) => ({
        value: el,
        label: el,
        icon: `/ss-element/${el}.webp`,
      })),
    []
  );

  const styleOptions: FilterOption[] = useMemo(() => {
    const vals = new Set<string>();
    for (const c of charList) {
      const style = loreMap[String(c.id)]?.style;
      if (style) vals.add(style);
    }
    return [...vals].sort().map((s) => ({ value: s, label: s }));
  }, [charList, loreMap]);

  const classOptions: FilterOption[] = useMemo(
    () => ['Vanguard', 'Versatile', 'Support'].map((c) => ({ value: c, label: c })),
    []
  );

  const rarityOptions: FilterOption[] = useMemo(
    () => [
      { value: '5', label: '5★' },
      { value: '4', label: '4★' },
    ],
    []
  );

  const combatTypeOptions: FilterOption[] = useMemo(
    () =>
      ['Melee', 'Ranged'].map((t) => ({
        value: t,
        label: t,
        icon: `/ss-class/${t}.png`,
        darkIconInLightMode: true,
      })),
    []
  );

  const factionOptions: FilterOption[] = useMemo(() => {
    const vals = new Set<string>();
    for (const c of charList) {
      const faction = loreMap[String(c.id)]?.faction;
      if (faction) vals.add(faction);
    }
    return [...vals].sort().map((f) => ({ value: f, label: f }));
  }, [charList, loreMap]);

  const roleConfig: Record<string, { badgeBg: string }> = {
    Vanguard: { badgeBg: 'bg-[#f43f5e]' },
    Versatile: { badgeBg: 'bg-[#6366f1]' },
    Support: { badgeBg: 'bg-[#10b981]' },
  };

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const filteredCharacters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charList.filter((char) => {
      const lore = loreMap[String(char.id)];
      const matchSearch =
        !q ||
        char.name.EN.toLowerCase().includes(q) ||
        (char.name.JP && char.name.JP.includes(search.trim())) ||
        (char.name.CN && char.name.CN.includes(search.trim()));
      const matchElement =
        selectedElements.length === 0 || selectedElements.includes(char.element);
      const matchStyle =
        selectedStyles.length === 0 || (lore?.style ? selectedStyles.includes(lore.style) : false);
      const matchClass = selectedClasses.length === 0 || selectedClasses.includes(char.class);
      const matchRarity =
        selectedRarities.length === 0 || selectedRarities.includes(String(char.star));
      const matchCombatType =
        selectedCombatTypes.length === 0 || selectedCombatTypes.includes(char.attackType);
      const matchFaction =
        selectedFactions.length === 0 ||
        (lore?.faction ? selectedFactions.includes(lore.faction) : false);
      return (
        matchSearch &&
        matchElement &&
        matchStyle &&
        matchClass &&
        matchRarity &&
        matchCombatType &&
        matchFaction
      );
    });
  }, [
    charList,
    loreMap,
    search,
    selectedElements,
    selectedStyles,
    selectedClasses,
    selectedRarities,
    selectedCombatTypes,
    selectedFactions,
  ]);

  const ACTIVE_CHIP_STYLE = 'bg-amber-500 text-slate-950 border-amber-600 font-semibold shadow-xs';
  const INACTIVE_CHIP_STYLE = 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover';

  const hasActiveFilters =
    Boolean(search) ||
    selectedElements.length > 0 ||
    selectedStyles.length > 0 ||
    selectedClasses.length > 0 ||
    selectedRarities.length > 0 ||
    selectedCombatTypes.length > 0 ||
    selectedFactions.length > 0;

  const handleClearFilters = () => {
    setSearch('');
    setSelectedElements([]);
    setSelectedStyles([]);
    setSelectedClasses([]);
    setSelectedRarities([]);
    setSelectedCombatTypes([]);
    setSelectedFactions([]);
    setOpenDropdown(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border-subtle pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Trekker Encyclopedia
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Browse all playable Trekkers in Stella Sora. Click any Trekker card to view their detailed profile, skills, and information.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative z-30 p-4 game-card celestial-card overflow-visible flex flex-col gap-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search Trekkers by name…"
            aria-label="Search Trekkers by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            suppressHydrationWarning
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-base border border-border-subtle text-xs sm:text-sm text-slate-900 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none transition-colors"
          />
        </div>

        <div ref={dropdownContainerRef} className="flex flex-wrap items-center gap-2 text-xs">
          <FilterDropdown
            label="Elements"
            options={elementOptions}
            selected={selectedElements}
            isOpen={openDropdown === 'elements'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'elements' ? null : 'elements'))}
            onToggle={(v) => toggleItem(setSelectedElements, v)}
            onClear={() => setSelectedElements([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
          <FilterDropdown
            label="Style"
            options={styleOptions}
            selected={selectedStyles}
            isOpen={openDropdown === 'style'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'style' ? null : 'style'))}
            onToggle={(v) => toggleItem(setSelectedStyles, v)}
            onClear={() => setSelectedStyles([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
          <FilterDropdown
            label="Class"
            options={classOptions}
            selected={selectedClasses}
            isOpen={openDropdown === 'class'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'class' ? null : 'class'))}
            onToggle={(v) => toggleItem(setSelectedClasses, v)}
            onClear={() => setSelectedClasses([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
          <FilterDropdown
            label="Rarity"
            options={rarityOptions}
            selected={selectedRarities}
            isOpen={openDropdown === 'rarity'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'rarity' ? null : 'rarity'))}
            onToggle={(v) => toggleItem(setSelectedRarities, v)}
            onClear={() => setSelectedRarities([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
          <FilterDropdown
            label="Combat Type"
            options={combatTypeOptions}
            selected={selectedCombatTypes}
            isOpen={openDropdown === 'combatType'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'combatType' ? null : 'combatType'))}
            onToggle={(v) => toggleItem(setSelectedCombatTypes, v)}
            onClear={() => setSelectedCombatTypes([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
          <FilterDropdown
            label="Faction"
            options={factionOptions}
            selected={selectedFactions}
            isOpen={openDropdown === 'faction'}
            onOpenToggle={() => setOpenDropdown((prev) => (prev === 'faction' ? null : 'faction'))}
            onToggle={(v) => toggleItem(setSelectedFactions, v)}
            onClear={() => setSelectedFactions([])}
            activeClass={ACTIVE_CHIP_STYLE}
            inactiveClass={INACTIVE_CHIP_STYLE}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-400',
              hasActiveFilters
                ? 'bg-base border-border-subtle text-slate-700 hover:text-slate-900 hover:border-border-hover cursor-pointer press-feedback'
                : 'bg-base/50 border-border-subtle/60 text-slate-400 cursor-not-allowed'
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-xs text-slate-600 flex items-center justify-between">
        <span>
          Showing <strong className="text-slate-900">{filteredCharacters.length}</strong> Trekkers
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-amber-600 hover:text-amber-700 text-xs font-medium cursor-pointer transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Trekkers Grid or Empty State */}
      {filteredCharacters.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3 game-card celestial-card p-8">
          <div className="size-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Search className="size-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Trekkers Found</h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-sm">
            No Trekkers match the current filters. Try resetting or adjusting your search criteria.
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
          {filteredCharacters.map((char) => {
            const isFiveStar = (char.star || 4) >= 5;
            const roleMeta = roleConfig[char.class] || { badgeBg: 'bg-slate-100 text-slate-700 border border-slate-300' };

            return (
              <Link
                key={char.id}
                href={`/trekkers/${encodeURIComponent(char.name.EN)}`}
                title={`View ${char.name.EN} details`}
                aria-label={`${char.name.EN}, ${char.star}-Star ${char.element} ${char.class}`}
                className={cn(
                  'group relative w-full aspect-[3.4/4.4] rounded-xl overflow-hidden bg-surface-card border select-none transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg block press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                  'cursor-pointer hover:border-border-hover',
                  isFiveStar
                    ? 'border-2 border-purple-400/40 shadow-md shadow-purple-500/10'
                    : 'border-2 border-border-subtle'
                )}
              >
                {/* Top Accent Line for 5-star vs 4-star */}
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 h-0.5 z-20',
                    isFiveStar
                      ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
                      : 'bg-[#fde047]'
                  )}
                />

                {/* Top Dark Gradient Overlay */}
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-10" />

                {/* Top-Left Element Badge */}
                <div className="absolute top-0.5 left-0.5 z-20 pointer-events-none">
                  <img
                    src={`/ss-element/${char.element}.webp`}
                    alt={char.element}
                    width={34}
                    height={34}
                    className="size-8 sm:size-8.5 object-contain drop-shadow-md"
                  />
                </div>

                {/* Top-Right Slanted Role Banner + Dark Navy Attack Type Box: High visibility */}
                <div className="absolute top-0 right-0 z-20 flex items-stretch h-5.5 shadow-sm pointer-events-none">
                  <div
                    className={cn(
                      'flex items-center px-2 text-[10px] font-bold tracking-tight text-white',
                      '[clip-path:polygon(7px_0%,100%_0%,100%_100%,0%_100%)] pl-2.5',
                      roleMeta.badgeBg
                    )}
                  >
                    {char.class}
                  </div>
                  <div className="bg-[#0f172a] px-1.5 flex items-center justify-center border-l border-white/20">
                    <img
                      src={`/ss-class/${char.attackType}.png`}
                      alt={char.attackType}
                      width={14}
                      height={14}
                      className="size-3.5 object-contain filter brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                </div>

                {/* Character Bust Artwork */}
                <img
                  src={getTrekkerImageUrl(char.id)}
                  alt={char.name.EN}
                  width={200}
                  height={260}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                />

                {/* Bottom Dark Gradient Fade */}
                <div className="absolute inset-x-0 bottom-1.5 h-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-10" />

                {/* Character Name & Stars at Bottom */}
                <div className="absolute bottom-2 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
                  <span className="font-bold text-xs sm:text-sm text-white tracking-tight drop-shadow truncate">
                    {char.name.EN}
                  </span>
                  {isFiveStar ? (
                    <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0 drop-shadow">
                      5★
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-300 font-mono font-bold shrink-0 drop-shadow">
                      4★
                    </span>
                  )}
                </div>

                {/* Bottom Horizontal Bar: 5-Star Rainbow/Purple vs 4-Star Yellow/Gold */}
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 h-1.5 z-20',
                    isFiveStar
                      ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                      : 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
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
