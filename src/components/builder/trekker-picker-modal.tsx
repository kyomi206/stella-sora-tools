'use client';

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import charactersData from '@/data/characters.json';
import { SSCharacter, ElementType, ClassType, SlotType, TeamBuild } from '@/types';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOverlayExit } from '@/lib/use-overlay-exit';
import { getTrekkerImageUrl } from '@/lib/wikitide';

interface TrekkerPickerModalProps {
  isOpen: boolean;
  slot?: SlotType;
  selectedId?: number;
  build?: TeamBuild;
  title?: React.ReactNode;
  subtitle?: string;
  characters?: Record<string, SSCharacter>;
  onClose: () => void;
  onSelect: (characterId: number) => void;
  onSwitchSlot?: (slot: SlotType) => void;
}

const ELEMENTS: ElementType[] = ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Umbra', 'Lux'];
const CLASSES: ClassType[] = ['Vanguard', 'Versatile', 'Support'];

const SLOTS_META: Array<{ slot: SlotType; label: string; badge: string }> = [
  { slot: 'vanguard', label: 'Vanguard', badge: 'bg-rose-500/20 text-rose-600 border-rose-500/40' },
  { slot: 'versatile', label: 'Versatile', badge: 'bg-indigo-500/20 text-indigo-700 border-indigo-500/40' },
  { slot: 'support', label: 'Support', badge: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40' },
];

const ROLE_CONFIG: Record<string, { badgeBg: string }> = {
  Vanguard: { badgeBg: 'bg-[#f43f5e]' },
  Versatile: { badgeBg: 'bg-[#6366f1]' },
  Support: { badgeBg: 'bg-[#10b981]' },
};


const TrekkerTile = memo(function TrekkerTile({
  char,
  isAssignedElsewhere,
  isSelected,
  onPick,
}: {
  char: SSCharacter;
  isAssignedElsewhere: boolean;
  isSelected: boolean;
  onPick: (characterId: number) => void;
}) {
  const isFiveStar = (char.star || 4) >= 5;
  const roleMeta = ROLE_CONFIG[char.class] || {
    badgeBg: 'bg-slate-100 text-slate-700 border border-slate-300',
  };

  return (
    <div
      role="button"
      tabIndex={isAssignedElsewhere ? -1 : 0}
      onClick={() => {
        if (isAssignedElsewhere) return;
        onPick(char.id);
      }}
      onKeyDown={(e) => {
        if (isAssignedElsewhere) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(char.id);
        }
      }}
      className={cn(
        'group relative w-full aspect-[3.4/4.4] rounded-xl overflow-hidden bg-surface-card border select-none transition-[border-color,transform,box-shadow]',
        isAssignedElsewhere
          ? 'opacity-35 grayscale cursor-not-allowed border-border-subtle'
          : 'cursor-pointer hover:scale-[1.02] hover:border-border-hover',
        !isAssignedElsewhere && isFiveStar
          ? 'border-2 border-purple-400/50 shadow-lg shadow-purple-500/10'
          : !isAssignedElsewhere
          ? 'border-2 border-border'
          : '',
        isSelected && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-surface-card z-10'
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
            className="size-3.5 object-contain filter brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>

      {/* Character Bust Artwork */}
      <img
        src={getTrekkerImageUrl(char.id)}
        alt={char.name.EN}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105 pointer-events-none"
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
    </div>
  );
});

export function TrekkerPickerModal({
  isOpen,
  slot,
  selectedId,
  build,
  title,
  subtitle,
  characters: externalCharacters,
  onClose: onCloseProp,
  onSelect,
  onSwitchSlot,
}: TrekkerPickerModalProps) {
  const { requestClose: onClose, isClosing } = useOverlayExit(onCloseProp, isOpen);
  const [search, setSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState<ElementType | 'All'>('All');
  const [selectedClass, setSelectedClass] = useState<ClassType | 'All'>('All');

  const characters = (externalCharacters || charactersData) as Record<string, SSCharacter>;
  const charList = useMemo(() => Object.values(characters), [characters]);

  // Handle Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute character IDs assigned to other slots so users cannot pick the same trekker twice
  const otherAssignedIds = useMemo(() => {
    if (!build || !slot) return new Set<number>();
    const ids = new Set<number>();
    (Object.keys(build.slots) as SlotType[]).forEach((s) => {
      if (s !== slot && build.slots[s].characterId) {
        ids.add(build.slots[s].characterId!);
      }
    });
    return ids;
  }, [build, slot]);

  const handlePick = useCallback(
    (characterId: number) => {
      onSelect(characterId);
      onClose();
    },
    [onSelect, onClose]
  );

  const filteredCharacters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charList.filter((char) => {
      const matchSearch =
        !q ||
        char.name.EN.toLowerCase().includes(q) ||
        (char.name.JP && char.name.JP.toLowerCase().includes(q)) ||
        (char.name.CN && char.name.CN.includes(search)) ||
        (char.name.TW && char.name.TW.includes(search));
      const matchElement = selectedElement === 'All' || char.element === selectedElement;
      const matchClass = selectedClass === 'All' || char.class === selectedClass;
      return matchSearch && matchElement && matchClass;
    });
  }, [charList, search, selectedElement, selectedClass]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trekker-picker-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 overlay-backdrop"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative w-full max-w-4xl max-h-[88vh] rounded-2xl border border-border-subtle bg-surface-card text-slate-900 flex flex-col shadow-2xl overflow-hidden modal-entrance overscroll-contain',
          isClosing && 'modal-exit'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Slot Tabs */}
        <div className="flex flex-col gap-3 p-4 sm:p-5 border-b border-border bg-surface-card shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="trekker-picker-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                {title ? (
                  title
                ) : slot ? (
                  <>
                    Select Trekker for <span className="capitalize text-amber-600">{slot}</span> Seat
                  </>
                ) : (
                  <>
                    Select <span className="text-amber-600">Trekker</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {subtitle ||
                  (slot
                    ? 'Choose a companion to assign to your squad'
                    : 'Choose a companion to calculate ascension & skill upgrades')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="size-8 rounded-lg border border-border flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-surface-hover transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-amber-400"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Seat switcher tabs */}
          {slot && onSwitchSlot && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="text-xs text-slate-600 font-medium">Seat:</span>
              <div className="flex items-center gap-1.5">
                {SLOTS_META.map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    onClick={() => onSwitchSlot(s.slot)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer',
                      slot === s.slot
                        ? `${s.badge} font-bold`
                        : 'bg-base text-slate-600 hover:text-slate-900 border-border'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-border flex flex-col gap-3 bg-surface-subtle shrink-0">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by Trekker name…"
              aria-label="Search by Trekker name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suppressHydrationWarning
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-base border border-border text-xs sm:text-sm text-slate-900 placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Elements Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedElement('All')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                  selectedElement === 'All'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-semibold'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                All Elements
              </button>
              {ELEMENTS.map((el) => (
                <button
                  key={el}
                  type="button"
                  onClick={() => setSelectedElement(el)}
                  className={cn(
                    'px-2 py-1 rounded-md border flex items-center gap-1.5 text-xs transition-colors cursor-pointer',
                    selectedElement === el
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-semibold'
                      : 'bg-base text-slate-600 border-border hover:text-slate-900 hover:border-border-hover'
                  )}
                >
                  <img
                    src={`/ss-element/${el}.webp`}
                    alt={el}
                    className="size-3.5 object-contain"
                  />
                  <span>{el}</span>
                </button>
              ))}
            </div>

            {/* Classes Filter */}
            <div className="flex items-center gap-1">
              {CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(selectedClass === cls ? 'All' : cls)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                    selectedClass === cls
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-semibold'
                      : 'bg-base text-slate-600 border-border hover:text-slate-900'
                  )}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trekkers Scrollable Viewport */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh] flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 auto-rows-max select-none">
            {filteredCharacters.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-600 text-sm">
                No Trekkers match the current search or filters.
              </div>
            ) : (
              filteredCharacters.map((char) => (
                <TrekkerTile
                  key={char.id}
                  char={char}
                  isAssignedElsewhere={otherAssignedIds.has(char.id)}
                  isSelected={
                    selectedId !== undefined
                      ? selectedId === char.id
                      : slot && build
                      ? build.slots[slot]?.characterId === char.id
                      : false
                  }
                  onPick={handlePick}
                />
              ))

            )}
          </div>
        </div>
      </div>
    </div>
  );
}
