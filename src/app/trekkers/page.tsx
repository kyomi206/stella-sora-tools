'use client';

import { useState, useMemo } from 'react';
import charactersData from '@/data/characters.json';
import { SSCharacter, ElementType, ClassType } from '@/types';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';

export default function TrekkersPage() {
  const [search, setSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState<ElementType | 'All'>('All');
  const [selectedClass, setSelectedClass] = useState<ClassType | 'All'>('All');
  const [selectedStar, setSelectedStar] = useState<number | 'All'>('All');
  const characters = charactersData as Record<string, SSCharacter>;

  const charList = useMemo(() => Object.values(characters), [characters]);

  const elements: ElementType[] = ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Umbra', 'Lux'];
  const classes: ClassType[] = ['Vanguard', 'Versatile', 'Support'];

  const roleConfig: Record<string, { badgeBg: string }> = {
    Vanguard: { badgeBg: 'bg-[#f43f5e]' },
    Versatile: { badgeBg: 'bg-[#6366f1]' },
    Support: { badgeBg: 'bg-[#10b981]' },
  };

  const filteredCharacters = useMemo(() => {
    const q = search.trim();
    return charList.filter((char) => {
      const matchSearch =
        !q ||
        char.name.EN.toLowerCase().includes(q.toLowerCase()) ||
        (char.name.JP && char.name.JP.includes(q)) ||
        (char.name.CN && char.name.CN.includes(q));
      const matchElement = selectedElement === 'All' || char.element === selectedElement;
      const matchClass = selectedClass === 'All' || char.class === selectedClass;
      const matchStar = selectedStar === 'All' || char.star === selectedStar;
      return matchSearch && matchElement && matchClass && matchStar;
    });
  }, [charList, search, selectedElement, selectedClass, selectedStar]);

  const ACTIVE_CHIP_STYLE = 'bg-amber-500 text-slate-950 border-amber-600 font-semibold shadow-xs';
  const INACTIVE_CHIP_STYLE = 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover';

  const handleClearFilters = () => {
    setSearch('');
    setSelectedElement('All');
    setSelectedClass('All');
    setSelectedStar('All');
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
      <div className="p-4 game-card celestial-card flex flex-col gap-3">
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Elements */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedElement('All')}
              className={cn(
                'px-2.5 py-1 rounded-md border transition-colors cursor-pointer text-xs font-medium press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                selectedElement === 'All'
                  ? ACTIVE_CHIP_STYLE
                  : INACTIVE_CHIP_STYLE
              )}
            >
              All Elements
            </button>
            {elements.map((el) => (
              <button
                key={el}
                type="button"
                onClick={() => setSelectedElement(selectedElement === el ? 'All' : el)}
                className={cn(
                  'px-2 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer text-xs press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                  selectedElement === el
                    ? ACTIVE_CHIP_STYLE
                    : INACTIVE_CHIP_STYLE
                )}
              >
                <img src={`/ss-element/${el}.webp`} alt={el} width={14} height={14} className="size-3.5 object-contain" />
                <span>{el}</span>
              </button>
            ))}
          </div>

          {/* Classes & Stars */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {classes.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(selectedClass === cls ? 'All' : cls)}
                  className={cn(
                    'px-2.5 py-1 rounded-md border transition-colors cursor-pointer text-xs press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                    selectedClass === cls
                      ? ACTIVE_CHIP_STYLE
                      : INACTIVE_CHIP_STYLE
                  )}
                >
                  {cls}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {[5, 4].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedStar(selectedStar === star ? 'All' : star)}
                  className={cn(
                    'px-2 py-1 rounded-md border font-sans transition-colors cursor-pointer text-xs press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                    selectedStar === star
                      ? ACTIVE_CHIP_STYLE
                      : INACTIVE_CHIP_STYLE
                  )}
                >
                  {star}★
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-xs text-slate-600 flex items-center justify-between">
        <span>
          Showing <strong className="text-slate-900">{filteredCharacters.length}</strong> Trekkers
        </span>
        {(search || selectedElement !== 'All' || selectedClass !== 'All' || selectedStar !== 'All') && (
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
