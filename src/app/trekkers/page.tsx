'use client';

import { useState, useMemo } from 'react';
import charactersData from '@/data/characters.json';
import { SSCharacter, ElementType, ClassType } from '@/types';
import { Search, Users, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';

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
    return charList.filter((char) => {
      const matchSearch =
        char.name.EN.toLowerCase().includes(search.toLowerCase()) ||
        (char.name.JP && char.name.JP.includes(search)) ||
        (char.name.CN && char.name.CN.includes(search));
      const matchElement = selectedElement === 'All' || char.element === selectedElement;
      const matchClass = selectedClass === 'All' || char.class === selectedClass;
      const matchStar = selectedStar === 'All' || char.star === selectedStar;
      return matchSearch && matchElement && matchClass && matchStar;
    });
  }, [charList, search, selectedElement, selectedClass, selectedStar]);

  const elementActiveStyles: Record<ElementType | 'All', string> = {
    All: 'bg-slate-100 text-slate-800 border-slate-300',
    Ignis: 'bg-rose-500/15 text-rose-600 border-rose-500/40 font-semibold',
    Aqua: 'bg-sky-500/15 text-sky-700 border-sky-500/40 font-semibold',
    Terra: 'bg-amber-500/15 text-amber-700 border-amber-500/40 font-semibold',
    Ventus: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 font-semibold',
    Umbra: 'bg-purple-500/15 text-purple-700 border-purple-500/40 font-semibold',
    Lux: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/40 font-semibold',
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border-subtle pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Trekker Encyclopedia
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Browse all playable Trekkers in Stella Sora. Click any Trekker card to view their complete official lore and profile on the Miraheze Wiki.
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
          {/* Elements with authentic elemental color mapping */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedElement('All')}
              className={cn(
                'px-2.5 py-1 rounded-md border transition-colors cursor-pointer text-xs font-medium press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                selectedElement === 'All'
                  ? elementActiveStyles.All
                  : 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover'
              )}
            >
              All Elements
            </button>
            {elements.map((el) => (
              <button
                key={el}
                type="button"
                onClick={() => setSelectedElement(el)}
                className={cn(
                  'px-2 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer text-xs press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                  selectedElement === el
                    ? elementActiveStyles[el]
                    : 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover'
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
                      ? 'bg-slate-100 text-slate-800 border-slate-300 font-semibold'
                      : 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover'
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
                      ? 'bg-slate-100 text-slate-800 border-slate-300 font-semibold'
                      : 'bg-base text-slate-600 border-border-subtle hover:text-slate-900 hover:border-border-hover'
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
        <span className="text-[11px] text-slate-600">
          Click to be redirected to Miraheze Wiki
        </span>
      </div>

      {/* Trekkers Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {filteredCharacters.map((char) => {
          const isFiveStar = (char.star || 4) >= 5;
          const roleMeta = roleConfig[char.class] || { badgeBg: 'bg-slate-100 text-slate-700 border border-slate-300' };
          const wikiUrl = `https://stellasora.miraheze.org/wiki/${encodeURIComponent(char.name.EN.replace(/ /g, '_'))}`;

          return (
            <a
              key={char.id}
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`View ${char.name.EN} on Miraheze Wiki`}
              className={cn(
                'group relative w-full aspect-[3.4/4.4] rounded-xl overflow-hidden bg-surface-card border select-none transition-[border-color,box-shadow] block press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
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
                src={getWikiTideTrekkerUrl(char.name.EN) || `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`}
                alt={char.name.EN}
                width={200}
                height={260}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const autumnVnUrl = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`;
                  if (target.src !== autumnVnUrl && !target.src.includes('ssassets')) {
                    target.src = autumnVnUrl;
                  } else if (!target.src.includes('/characters/')) {
                    target.src = `/characters/head_${char.id}01_XL.webp`;
                  }
                }}
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

              {/* Subtle hover overlay badge */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none flex items-center justify-center">
                <div className="bg-surface-elevated/90 text-slate-900 text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-border-subtle">
                  <ExternalLink className="size-3 text-amber-600" aria-hidden="true" />
                  <span>Wiki Profile</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
