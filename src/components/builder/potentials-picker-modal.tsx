'use client';

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import charactersData from '@/data/characters.json';
import {
  SSPotentialFull,
  SelectedPotential,
  SlotType,
  PotentialPriority,
  SSCharacter,
  TeamBuild,
} from '@/types';
import {
  getCharacterPotentials,
  getPotentialById,
  formatPotentialDesc,
  getPotentialImageUrl,
} from '@/lib/potentials';
import { X, Trash2, Sparkles, ChevronRight, SlidersHorizontal, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOverlayExit } from '@/lib/use-overlay-exit';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';

interface PotentialsPickerModalProps {
  isOpen: boolean;
  activeSlot: SlotType;
  build: TeamBuild;
  onClose: () => void;
  onSwitchSlot: (slot: SlotType) => void;
  onUpdateSlotPotentials: (slot: SlotType, potentials: SelectedPotential[]) => void;
  onSwapSlots?: (fromSlot: SlotType, toSlot: SlotType) => void;
}

// Memoized grid card so hovering one potential doesn't re-render every sibling
// in the grid (same pattern as DiscGridCard / TrekkerTile).
const AvailablePotentialCard = memo(function AvailablePotentialCard({
  pot,
  isCoreLocked,
  onSelect,
  onHoverEnter,
  onHoverEnd,
}: {
  pot: SSPotentialFull;
  isCoreLocked: boolean;
  onSelect: (pot: SSPotentialFull) => void;
  onHoverEnter: (pot: SSPotentialFull, rect: DOMRect) => void;
  onHoverEnd: () => void;
}) {
  return (
    <div
      onClick={() => onSelect(pot)}
      onMouseEnter={(e) => onHoverEnter(pot, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHoverEnd}
      className={cn(
        /* Clean potential card: NO white outline, NO duplicate text banner */
        'group relative aspect-[3/3.8] rounded-md overflow-hidden transition-transform select-none shadow-sm',
        isCoreLocked
          ? 'opacity-40 grayscale cursor-not-allowed'
          : 'hover:scale-105 hover:ring-2 hover:ring-sky-400 hover:shadow-lg cursor-pointer'
      )}
    >
      {/* The full-bleed potential graphic containing vestige, icon, subicon, and name directly inside */}
      <img
        src={getPotentialImageUrl(pot.id)}
        alt={pot.name}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-contain pointer-events-none"
        onError={(e) => {
          (e.target as HTMLElement).style.opacity = '0.5';
        }}
      />

      {/* Top-Right Info Circle Button (i) */}
      <div
        title="Hover to view combat effect"
        className="absolute top-1 right-1 size-4 rounded-full bg-black/50 backdrop-blur-xs border border-white/40 text-white group-hover:bg-black/80 flex items-center justify-center text-[10px] font-bold z-20 pointer-events-none"
      >
        i
      </div>

      {/* Top-Left Core Badge */}
      {pot.isCore && (
        <div className="absolute top-1 left-1 z-20">
          <span className="px-1 py-0.2 rounded bg-amber-500 text-black text-[7.5px] font-black uppercase shadow">
            Core
          </span>
        </div>
      )}

      {isCoreLocked && (
        <div className="absolute top-1 left-1 z-20">
          <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[7px] font-bold flex items-center gap-0.5 shadow">
            <Lock className="size-2" />
            <span>2/2</span>
          </span>
        </div>
      )}
    </div>
  );
});

export function PotentialsPickerModal({
  isOpen,
  activeSlot,
  build,
  onClose: onCloseProp,
  onSwitchSlot,
  onUpdateSlotPotentials,
  onSwapSlots,
}: PotentialsPickerModalProps) {
  const { requestClose: onClose, isClosing } = useOverlayExit(onCloseProp, isOpen);
  const [filterCategory, setFilterCategory] = useState<'all' | 'core' | 'normal' | 'common'>('all');
  const [showAllPool, setShowAllPool] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<SlotType | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotType | null>(null);

  // Floating Hover Popout state
  const [hoverState, setHoverState] = useState<{
    pot: SSPotentialFull;
    level: number;
    targetRect?: DOMRect;
  } | null>(null);

  const characters = charactersData as Record<string, SSCharacter>;

  // Currently active slot info
  const activeSlotData = build.slots[activeSlot];
  const activeChar = activeSlotData.characterId
    ? characters[String(activeSlotData.characterId)]
    : null;

  const currentSelectedPotentials = activeSlotData.potentials;

  // Selected map for quick lookup
  const selectedMap = useMemo(() => {
    const map = new Map<number, SelectedPotential>();
    currentSelectedPotentials.forEach((p) => map.set(p.id, p));
    return map;
  }, [currentSelectedPotentials]);

  // All potentials for active character from potentials-db
  const rawPotentials = useMemo(() => {
    if (!activeChar) return [];
    return getCharacterPotentials(activeChar.id);
  }, [activeChar]);

  // Count currently selected Core Potentials (inherent core potentials, max 2 allowed)
  const selectedCoreCount = useMemo(() => {
    return currentSelectedPotentials.filter((sel) => {
      const p = rawPotentials.find((item) => item.id === sel.id);
      return p?.isCore === true;
    }).length;
  }, [currentSelectedPotentials, rawPotentials]);

  // Potential count equal to the sum of levels of the potentials (1 core = 1, 1 lv6 = 6)
  const getSlotPotentialLevelSum = (slotType: SlotType) => {
    const sData = build.slots[slotType];
    if (!sData.characterId || !sData.potentials) return 0;
    return sData.potentials.reduce((sum, p) => {
      const fullPot = getPotentialById(sData.characterId!, p.id);
      const lvl = Number(p.level) || (fullPot?.isCore ? 1 : 6);
      return sum + lvl;
    }, 0);
  };

  const currentSelectedLevelSum = useMemo(() => {
    if (!activeChar) return 0;
    return currentSelectedPotentials.reduce((sum, p) => {
      const fullPot = getPotentialById(activeChar.id, p.id);
      const lvl = Number(p.level) || (fullPot?.isCore ? 1 : 6);
      return sum + lvl;
    }, 0);
  }, [activeChar, currentSelectedPotentials]);

  // Filter based on Vanguard vs Assist slot, or show all
  const filteredCategoryPotentials = useMemo(() => {
    if (!activeChar) return [];
    const isVanguard = activeSlot === 'vanguard';

    return rawPotentials.filter((p) => {
      // Slot filtering
      if (!showAllPool) {
        if (isVanguard && p.slot === 'assist') return false;
        if (!isVanguard && p.slot === 'vanguard') return false;
      }

      // Category tab filtering
      if (filterCategory === 'core') return p.isCore;
      if (filterCategory === 'normal') return !p.isCore && p.group.includes('Normal');
      if (filterCategory === 'common') return p.group === 'common';

      return true;
    });
  }, [activeChar, rawPotentials, activeSlot, showAllPool, filterCategory]);

  // AVAILABLE POTENTIALS:
  // Must DISAPPEAR from the choose potentials window once chosen!
  const availablePotentials = useMemo(() => {
    return filteredCategoryPotentials.filter((p) => !selectedMap.has(p.id));
  }, [filteredCategoryPotentials, selectedMap]);

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

  const choosePotential = useCallback(
    (p: SSPotentialFull) => {
      // Only two core potentials can be chosen rule
      if (p.isCore && selectedCoreCount >= 2) {
        setAlertMessage('Maximum of 2 Core Potentials allowed per Trekker.');
        setTimeout(() => setAlertMessage(null), 3000);
        return;
      }

      // Default priority: Core potentials default to "Core", normal potentials default to "Medium"
      const defaultPriority: PotentialPriority = p.isCore ? 'Core' : 'Medium';
      // Default level: 6 (matching game preview standard) or maxLevel
      const defaultLevel = p.isCore ? undefined : 6;

      onUpdateSlotPotentials(activeSlot, [
        ...currentSelectedPotentials,
        {
          id: p.id,
          rarity: p.rarityNum,
          level: defaultLevel,
          priority: defaultPriority,
        },
      ]);
    },
    [activeSlot, currentSelectedPotentials, onUpdateSlotPotentials, selectedCoreCount]
  );

  const handleHoverEnter = useCallback((p: SSPotentialFull, rect: DOMRect) => {
    setHoverState({ pot: p, level: p.isCore ? 1 : 6, targetRect: rect });
  }, []);

  const handleHoverEnd = useCallback(() => setHoverState(null), []);

  if (!isOpen) return null;

  const removePotential = (id: number) => {
    onUpdateSlotPotentials(
      activeSlot,
      currentSelectedPotentials.filter((item) => item.id !== id)
    );
  };

  const updateLevel = (id: number, level: number) => {
    onUpdateSlotPotentials(
      activeSlot,
      currentSelectedPotentials.map((item) =>
        item.id === id ? { ...item, level } : item
      )
    );
  };

  const updatePriority = (id: number, priority: PotentialPriority) => {
    onUpdateSlotPotentials(
      activeSlot,
      currentSelectedPotentials.map((item) =>
        item.id === id ? { ...item, priority } : item
      )
    );
  };

  const slotsMeta: Array<{ slot: SlotType; label: string; badge: string }> = [
    { slot: 'vanguard', label: 'Vanguard', badge: 'bg-[#f43f5e] text-white' },
    { slot: 'versatile', label: 'Versatile', badge: 'bg-[#6366f1] text-white' },
    { slot: 'support', label: 'Support', badge: 'bg-[#10b981] text-white' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="potentials-picker-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 overlay-backdrop"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative w-full max-w-5xl h-[92vh] max-h-[880px] rounded-2xl border border-border/70 bg-surface-card text-foreground flex flex-col shadow-2xl overflow-hidden modal-entrance overscroll-contain',
          isClosing && 'modal-exit'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-secondary/20 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="size-4.5 text-amber-600" aria-hidden="true" />
            <h2 id="potentials-picker-modal-title" className="text-base font-bold text-foreground">
              Choose Potentials & Priorities
            </h2>
            {/* Core Potentials Quota indicator (max 2) */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 text-xs font-semibold">
              <span>Core Potentials:</span>
              <span className="font-mono font-black">{selectedCoreCount}/2</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="size-8 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-amber-400"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Alert Banner for Core Limit */}
        {alertMessage && (
          <div role="alert" aria-live="polite" className="bg-rose-500/20 border-b border-rose-500/50 px-4 py-1.5 text-xs text-rose-600 flex items-center gap-2 animate-in slide-in-from-top duration-150 shrink-0">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{alertMessage}</span>
          </div>
        )}

        {/* Modal Body: Left Sidebar + Right Main Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Trekkers already selected with small icon and name underneath */}
          <div className="w-28 sm:w-36 md:w-44 border-r border-border/40 bg-surface-subtle p-3 flex flex-col gap-3 shrink-0 overflow-y-auto select-none">
            <span className="text-xs font-medium text-slate-600 text-center sm:text-left">
              Squad Trekkers
            </span>

            <div className="flex flex-col gap-2.5">
              {slotsMeta.map(({ slot, label, badge }) => {
                const charId = build.slots[slot].characterId;
                const char = charId ? characters[String(charId)] : null;
                const isCurrent = activeSlot === slot;
                const potCount = getSlotPotentialLevelSum(slot);
                const isDragging = draggedSlot === slot;
                const isDragOver = dragOverSlot === slot && draggedSlot !== slot;

                return (
                  <div
                    key={slot}
                    role="button"
                    tabIndex={0}
                    draggable={!!char}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', slot);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedSlot(slot);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverSlot !== slot) setDragOverSlot(slot);
                    }}
                    onDragLeave={() => {
                      setDragOverSlot(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const source = (e.dataTransfer.getData('text/plain') as SlotType) || draggedSlot;
                      if (source && source !== slot) {
                        onSwapSlots?.(source, slot);
                        if (activeSlot === source) {
                          onSwitchSlot(slot);
                        } else if (activeSlot === slot) {
                          onSwitchSlot(source);
                        }
                      }
                      setDraggedSlot(null);
                      setDragOverSlot(null);
                    }}
                    onDragEnd={() => {
                      setDraggedSlot(null);
                      setDragOverSlot(null);
                    }}
                    onClick={() => {
                      if (char) onSwitchSlot(slot);
                    }}
                    title={char ? "Click to configure, or drag to swap slot location" : "Drag a trekker here to assign"}
                    className={cn(
                      'p-2 rounded-xl border flex flex-col items-center text-center gap-1.5 transition-colors relative select-none',
                      !char && 'opacity-50 cursor-pointer border-dashed border-border/50 hover:border-sky-400/80',
                      char && 'cursor-grab active:cursor-grabbing',
                      isDragging && 'opacity-40 scale-95 ring-2 ring-dashed ring-sky-400',
                      isDragOver && 'ring-2 ring-sky-400 scale-105 bg-sky-500/25 border-sky-400 shadow-lg shadow-sky-500/20 z-10',
                      !isDragOver && !isDragging && isCurrent
                        ? 'border-sky-400 bg-sky-500/15 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/50'
                        : !isDragOver && !isDragging
                        ? 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-border'
                        : ''
                    )}
                  >
                    {/* Slot badge */}
                    <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm', badge)}>
                      {label}
                    </span>

                    {/* Trekker Avatar Icon */}
                    {char ? (
                      <div className="relative size-12 sm:size-14 rounded-lg overflow-hidden border border-slate-300 bg-muted shrink-0 shadow-sm pointer-events-none">
                        <img
                          src={
                            getWikiTideTrekkerUrl(char.name.EN) ||
                            `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`
                          }
                          alt={char.name.EN}
                          className="w-full h-full object-cover object-top"
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
                        {/* Small element icon at top-left matching ex.png */}
                        <div className="absolute top-0.5 left-0.5 size-4">
                          <img
                            src={`/ss-element/${char.element}.webp`}
                            alt={char.element}
                            className="size-full object-contain drop-shadow"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="size-12 sm:size-14 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none">
                        {isDragOver ? 'Drop here' : 'Empty'}
                      </div>
                    )}

                    {/* Name underneath */}
                    <span className="text-[11px] font-bold text-foreground truncate max-w-full pointer-events-none">
                      {char ? char.name.EN : 'Not set'}
                    </span>

                    {char && (
                      <span className="text-[9px] text-sky-600 font-mono font-semibold pointer-events-none">
                        {potCount} {potCount === 1 ? 'potential' : 'potentials'}
                      </span>
                    )}

                    {isCurrent && (
                      <div className="absolute -right-1 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none">
                        <ChevronRight className="size-3.5 text-sky-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Main Area: Available Potentials (No white outline, no duplicate name) + Chosen Potentials (cpotok.png) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-card">
            {/* Filter Toolbar for Available Potentials */}
            <div className="px-4 py-2 border-b border-border/30 flex flex-wrap items-center justify-between gap-2 text-xs bg-secondary/15 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-muted-foreground text-[11px] mr-1">Available:</span>
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                    filterCategory === 'all'
                      ? 'bg-sky-500/20 text-sky-700 border-sky-500/40 font-bold'
                      : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
                  )}
                >
                  All ({availablePotentials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('core')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                    filterCategory === 'core'
                      ? 'bg-amber-400/20 text-amber-700 border-amber-400/40 font-bold'
                      : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
                  )}
                >
                  Core ({availablePotentials.filter((p) => p.isCore).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('normal')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                    filterCategory === 'normal'
                      ? 'bg-purple-400/20 text-purple-700 border-purple-400/40 font-bold'
                      : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
                  )}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('common')}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                    filterCategory === 'common'
                      ? 'bg-blue-400/20 text-blue-700 border-blue-400/40 font-bold'
                      : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
                  )}
                >
                  Common
                </button>

                <button
                  type="button"
                  onClick={() => setShowAllPool(!showAllPool)}
                  className={cn(
                    'ml-2 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer',
                    showAllPool
                      ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40'
                      : 'bg-card/30 text-muted-foreground border-border/30 hover:text-foreground'
                  )}
                >
                  {showAllPool ? 'Showing All Pool' : 'Slot Specific'}
                </button>
              </div>

              {currentSelectedPotentials.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdateSlotPotentials(activeSlot, [])}
                  className="text-rose-600 hover:text-rose-600 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  <span>Reset ({currentSelectedPotentials.length})</span>
                </button>
              )}
            </div>

            {/* Top Grid: Available Potentials (No white outline, no duplicate name, disappearing when chosen) */}
            <div className="flex-1 overflow-y-auto p-4 select-none min-h-[200px]">
              {availablePotentials.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-1">
                  <span>No available potentials in this category.</span>
                  {currentSelectedPotentials.length > 0 && (
                    <span className="text-xs text-sky-600">
                      All matching potentials have been chosen below.
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 content-start">
                  {availablePotentials.map((p) => {
                    const isCoreLocked = p.isCore && selectedCoreCount >= 2;

                    return (
                      <AvailablePotentialCard
                        key={p.id}
                        pot={p}
                        isCoreLocked={isCoreLocked}
                        onSelect={choosePotential}
                        onHoverEnter={handleHoverEnter}
                        onHoverEnd={handleHoverEnd}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Section: Chosen Potentials matching cpotok.png */}
            <div className="border-t border-border/50 bg-surface-subtle p-3 max-h-[310px] overflow-y-auto shrink-0 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-3.5 text-sky-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Chosen Potentials & Priorities ({currentSelectedLevelSum})
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Adjust Level & Priority. Click red X to remove back to available pool.
                </span>
              </div>

              {currentSelectedPotentials.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed border-border/40 rounded-xl">
                  No potentials chosen yet. Click any available potential above to add it.
                </div>
              ) : (
                /* Flex-wrap row of vertical chosen potential cards matching cpotok.png */
                <div className="flex flex-wrap gap-3.5 items-start py-1">
                  {currentSelectedPotentials.map((sel) => {
                    const p = rawPotentials.find((item) => item.id === sel.id);
                    if (!p) return null;
                    const levelVal = Number(sel.level) || (p.isCore ? 1 : 6);
                    const currentPriority = (sel.priority || (p.isCore ? 'Core' : 'Medium')) as PotentialPriority;

                    return (
                      <div
                        key={sel.id}
                        className="w-[72px] sm:w-[80px] flex flex-col gap-1.5 shrink-0 select-none group"
                      >
                        {/* Potential Card with Level at top-left and Red (X) at top-right matching cpotok.png */}
                          <div
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoverState({
                                pot: p,
                                level: levelVal,
                                targetRect: rect,
                              });
                            }}
                            onMouseLeave={() => setHoverState(null)}
                            className="relative aspect-[3/3.8] rounded-md overflow-hidden bg-surface-card shadow-sm border border-slate-200/70 cursor-pointer"
                          >
                            {/* Level in the middle of the white space on top (circle in potp.png, fixed b.png) */}
                            {!p.isCore ? (
                              <div className="absolute left-[15%] top-[5.5%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
                                <span
                                  style={{ color: '#0f172a' }}
                                  className="text-[10px] sm:text-[11px] font-mono font-extrabold text-slate-900 dark:!text-slate-950 leading-none select-none"
                                >
                                  {levelVal}
                                </span>
                              </div>
                            ) : (
                            <div className="absolute top-0.5 left-0.5 px-1 py-0.2 bg-amber-500 text-black text-[7px] font-black uppercase rounded z-10 shadow pointer-events-none">
                              Core
                            </div>
                          )}

                          {/* Top-Right Red Circular Delete Button matching cpotok.png */}
                          <button
                            type="button"
                            title="Remove potential back to available pool"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePotential(sel.id);
                            }}
                            className="absolute top-1 right-1 size-4.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center z-20 shadow-md cursor-pointer transition-transform hover:scale-110"
                          >
                            <X className="size-3 stroke-[2.5]" />
                          </button>

                          {/* Official Potential Graphic */}
                          <img
                            src={getPotentialImageUrl(p.id)}
                            alt={p.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        </div>

                        {/* First Selector: Level Dropdown [ 6  v ] matching cpotok.png */}
                        {!p.isCore ? (
                          <div className="relative w-full">
                            <select
                              value={levelVal}
                              onChange={(e) => updateLevel(sel.id, Number(e.target.value))}
                              className="w-full appearance-none bg-surface-subtle hover:bg-surface-hover border border-slate-300 rounded-md text-[10px] sm:text-[11px] font-mono font-bold text-center text-slate-900 py-0.5 pr-4 pl-1 focus:outline-none focus:border-sky-400 cursor-pointer transition-colors"
                            >
                              {Array.from({ length: p.maxLevel || 9 }, (_, i) => i + 1).map((lv) => (
                                <option key={lv} value={lv} className="bg-surface-card text-slate-900">
                                  {lv}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-slate-600 text-[9px]">
                              ▼
                            </div>
                          </div>
                        ) : (
                          <div className="w-full py-0.5 text-center text-[10px] font-mono font-bold text-amber-600 bg-surface-subtle border border-amber-500/30 rounded-md">
                            Core
                          </div>
                        )}

                        {/* Second Selector: Priority Dropdown [ Optional v ] matching cpotok.png */}
                        <div className="relative w-full">
                          <select
                            value={currentPriority}
                            onChange={(e) => updatePriority(sel.id, e.target.value as PotentialPriority)}
                            className={cn(
                              'w-full appearance-none bg-surface-subtle hover:bg-surface-hover border rounded-md text-[9.5px] sm:text-[10px] font-semibold text-center py-0.5 pr-4 pl-1 focus:outline-none cursor-pointer transition-colors',
                              currentPriority === 'Core'
                                ? 'text-teal-700 border-teal-500/50'
                                : currentPriority === 'Medium'
                                ? 'text-indigo-700 border-indigo-500/50'
                                : currentPriority === 'Low'
                                ? 'text-amber-700 border-amber-500/50'
                                : 'text-rose-600 border-rose-500/50'
                            )}
                          >
                            <option value="Core" className="bg-surface-card text-teal-600">
                              Core
                            </option>
                            <option value="Medium" className="bg-surface-card text-indigo-600">
                              Medium
                            </option>
                            <option value="Low" className="bg-surface-card text-amber-600">
                              Low
                            </option>
                            <option value="Optional" className="bg-surface-card text-rose-600">
                              Optional
                            </option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-slate-600 text-[9px]">
                            ▼
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-border/40 bg-secondary/30 flex items-center justify-between shrink-0 text-xs">
          <span className="text-muted-foreground">
            {activeChar?.name.EN}: <strong className="text-sky-600">{currentSelectedLevelSum}</strong> potentials assigned ({selectedCoreCount}/2 Core)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-md"
          >
            Done
          </button>
        </div>
      </div>

      {/* Floating Hover Popover matching pop.png */}
      {hoverState && hoverState.targetRect && (() => {
        const rect = hoverState.targetRect;
        const centerX = rect.left + rect.width / 2;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const popupLeft = Math.max(160, Math.min(centerX, windowWidth - 160));
        const arrowOffset = centerX - popupLeft;
        const showBelow = rect.top < 120;

        return (
          <div
            className="fixed z-[70] pointer-events-none transition-opacity duration-100"
            style={{
              left: `${popupLeft}px`,
              top: showBelow ? `${rect.bottom + 10}px` : `${rect.top - 10}px`,
              transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <div className="relative bg-surface-card text-slate-800 text-[12px] sm:text-[13px] leading-snug rounded-xl px-4 py-2.5 shadow-2xl border border-slate-200/90 max-w-[280px] sm:max-w-[320px] text-left">
              <p className="font-normal select-none">
                {formatPotentialDesc(hoverState.pot.descTemplate, hoverState.pot.params, hoverState.level)}
              </p>

              {/* Speech bubble tail pointer */}
              {showBelow ? (
                <div
                  className="absolute bottom-full -mb-[1px] -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-b-[7px] border-b-white drop-shadow-[0_-2px_2px_rgba(0,0,0,0.06)] pointer-events-none"
                  style={{ left: `calc(50% + ${arrowOffset}px)` }}
                />
              ) : (
                <div
                  className="absolute top-full -mt-[1px] -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[7px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.06)] pointer-events-none"
                  style={{ left: `calc(50% + ${arrowOffset}px)` }}
                />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
