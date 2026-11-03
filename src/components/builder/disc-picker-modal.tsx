'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { SSDisc, ElementType, AdvancedTeamBuild } from '@/types';
import {
  getDiscOutfitIconUrl,
  getNoteIconUrl,
  NOTE_BY_NAME,
} from '@/data/notes';
import { DiscDetailCard } from './disc-detail-card';
import { X, Search, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DiscSlotRef = {
  kind: 'main' | 'support';
  index: 0 | 1 | 2;
};

interface DiscPickerModalProps {
  isOpen: boolean;
  activeSlot: DiscSlotRef;
  build: AdvancedTeamBuild;
  discs: Record<string, SSDisc>;
  onClose: () => void;
  onSelect: (slot: DiscSlotRef, discId: number) => void;
  onSwitchSlot: (slot: DiscSlotRef) => void;
}

const ELEMENTS: ('All' | ElementType | 'None')[] = [
  'All',
  'Ignis',
  'Aqua',
  'Terra',
  'Ventus',
  'Lux',
  'Umbra',
  'None',
];

const RARITIES: ('All' | 5 | 4 | 3)[] = ['All', 5, 4, 3];

export function DiscPickerModal({
  isOpen,
  activeSlot,
  build,
  discs,
  onClose,
  onSelect,
  onSwitchSlot,
}: DiscPickerModalProps) {
  const [search, setSearch] = useState('');
  const [elementFilter, setElementFilter] = useState<'All' | ElementType | 'None'>('All');
  const [rarityFilter, setRarityFilter] = useState<'All' | 5 | 4 | 3>('All');
  const [hoveredDisc, setHoveredDisc] = useState<{
    disc: SSDisc;
    targetRect: DOMRect;
  } | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen, onClose]);

  // Clear hover state on slot or filter changes
  useEffect(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setHoveredDisc(null);
  }, [activeSlot, elementFilter, rarityFilter, search]);

  const equippedIds = useMemo(() => {
    const map = new Map<number, string>();
    build.mainDiscs.forEach((d, idx) => {
      if (d.discId) map.set(d.discId, `Main ${idx + 1}`);
    });
    build.supportDiscs.forEach((d, idx) => {
      if (d.discId) map.set(d.discId, `Support ${idx + 1}`);
    });
    return map;
  }, [build.mainDiscs, build.supportDiscs]);

  const currentSlotDiscId =
    activeSlot.kind === 'main'
      ? build.mainDiscs[activeSlot.index].discId
      : build.supportDiscs[activeSlot.index].discId;

  const filteredDiscs = useMemo(() => {
    const list = Object.values(discs);
    return list
      .filter((d) => {
        if (elementFilter !== 'All' && d.element !== elementFilter) return false;
        if (rarityFilter !== 'All' && d.star !== rarityFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = d.name.toLowerCase().includes(q);
          const matchTag = d.tag?.some((t) => t.toLowerCase().includes(q));
          const matchChar = d.char?.some((c) => c.toLowerCase().includes(q));
          const matchSkill = d.mainSkill?.name.toLowerCase().includes(q);
          if (!matchName && !matchTag && !matchChar && !matchSkill) return false;
        }
        return true;
      })
      .sort((a, b) => b.star - a.star || b.id - a.id);
  }, [discs, elementFilter, rarityFilter, search]);

  if (!isOpen) return null;

  const slotTabs: { label: string; ref: DiscSlotRef }[] = [
    { label: 'Main 1', ref: { kind: 'main', index: 0 } },
    { label: 'Main 2', ref: { kind: 'main', index: 1 } },
    { label: 'Main 3', ref: { kind: 'main', index: 2 } },
    { label: 'Support 1', ref: { kind: 'support', index: 0 } },
    { label: 'Support 2', ref: { kind: 'support', index: 1 } },
    { label: 'Support 3', ref: { kind: 'support', index: 2 } },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Select Runic Disc"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="flex flex-col gap-3 p-4 border-b border-border bg-surface-subtle">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Disc className="size-5 text-amber-500" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Select {activeSlot.kind === 'main' ? `Main Disc #${activeSlot.index + 1}` : `Support Disc #${activeSlot.index + 1}`}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold">
                {activeSlot.kind === 'main' ? 'Melody & Harmony Active' : 'Grants Starting Notes & Stats'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close disc picker"
              className="p-1.5 rounded-lg text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* 6-Slot Quick Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {slotTabs.map((tab) => {
              const isActive =
                tab.ref.kind === activeSlot.kind && tab.ref.index === activeSlot.index;
              const slotDiscId =
                tab.ref.kind === 'main'
                  ? build.mainDiscs[tab.ref.index].discId
                  : build.supportDiscs[tab.ref.index].discId;
              const slotDisc = slotDiscId ? discs[String(slotDiscId)] : null;

              return (
                <button
                  key={`${tab.ref.kind}-${tab.ref.index}`}
                  type="button"
                  onClick={() => onSwitchSlot(tab.ref)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5',
                    isActive
                      ? tab.ref.kind === 'main'
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-surface-card text-slate-600 dark:text-white/80 border-border hover:text-slate-900 dark:hover:text-white hover:border-border-hover'
                  )}
                >
                  <span>{tab.label}</span>
                  {slotDisc && (
                    <span className="opacity-80 truncate max-w-[90px] font-normal">
                      • {slotDisc.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="size-4 text-slate-500 dark:text-white/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search disc name, tag, or trekker…"
                aria-label="Search discs"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-base border border-border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {RARITIES.map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer',
                    rarityFilter === r
                      ? 'bg-amber-500 text-slate-950 border-amber-600'
                      : 'bg-surface-card text-slate-600 dark:text-white/80 border-border hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  {r === 'All' ? 'All ★' : `${r}★`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {ELEMENTS.map((el) => (
              <button
                key={el}
                type="button"
                onClick={() => setElementFilter(el)}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1',
                  elementFilter === el
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : 'bg-surface-card text-slate-600 dark:text-white/80 border-border hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {el !== 'All' && el !== 'None' && (
                  <img
                    src={`/ss-element/${el}.webp`}
                    alt=""
                    className="size-3.5 object-contain"
                  />
                )}
                <span>{el}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Disc Grid */}
        <div
          onScroll={() => setHoveredDisc(null)}
          className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {filteredDiscs.map((disc) => {
            const equippedIn = equippedIds.get(disc.id);
            const isCurrentSlot = currentSlotDiscId === disc.id;
            const isEquippedElsewhere = !!equippedIn && !isCurrentSlot;

            const maxSupportNotes =
              disc.supportNote?.[disc.supportNote.length - 1] || {};
            const reqNotes1 = disc.secondarySkill1?.requirements?.[0] || {};
            const reqNotes2 = disc.secondarySkill2?.requirements?.[0] || {};
            const harmonyNoteNames = Array.from(
              new Set([...Object.keys(reqNotes1), ...Object.keys(reqNotes2)])
            );

            return (
              <button
                key={disc.id}
                type="button"
                disabled={isEquippedElsewhere}
                onClick={() => {
                  onSelect(activeSlot, disc.id);
                  onClose();
                }}
                onMouseEnter={(e) => {
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                  }
                  setHoveredDisc({
                    disc,
                    targetRect: e.currentTarget.getBoundingClientRect(),
                  });
                }}
                onMouseMove={(e) => {
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDisc((prev) =>
                    prev && prev.disc.id === disc.id
                      ? { ...prev, targetRect: rect }
                      : { disc, targetRect: rect }
                  );
                }}
                onMouseLeave={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = setTimeout(() => {
                    setHoveredDisc(null);
                  }, 250);
                }}
                className={cn(
                  'text-left rounded-xl border p-3 flex gap-3.5 transition-colors relative group/card',
                  isCurrentSlot
                    ? 'border-amber-500 bg-amber-500/10 cursor-pointer shadow-sm'
                    : isEquippedElsewhere
                    ? 'border-border bg-surface-subtle opacity-50 cursor-not-allowed'
                    : 'border-border bg-surface-card hover:border-amber-500/60 hover:bg-surface-elevated cursor-pointer shadow-xs'
                )}
              >
                {/* 1. Bigger Disc Image */}
                <div
                  className={cn(
                    'relative size-24 sm:size-28 rounded-xl overflow-hidden shrink-0 border-2 flex items-center justify-center bg-base shadow-sm transition-transform group-hover/card:scale-[1.02]',
                    disc.star === 5
                      ? 'border-amber-500/70 shadow-amber-500/10'
                      : disc.star === 4
                      ? 'border-purple-500/70 shadow-purple-500/10'
                      : 'border-sky-500/70 shadow-sky-500/10'
                  )}
                >
                  <img
                    src={getDiscOutfitIconUrl(disc.id, 'full')}
                    alt={disc.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                  {disc.element !== 'None' && (
                    <img
                      src={`/ss-element/${disc.element}.webp`}
                      alt={disc.element}
                      className="absolute top-1.5 left-1.5 size-5 sm:size-6 drop-shadow"
                    />
                  )}
                  <span className="absolute bottom-1 right-1 text-xs font-black px-1.5 py-0.5 rounded-md bg-black/85 text-amber-400 border border-amber-400/30 shadow-xs">
                    {disc.star}★
                  </span>
                </div>

                {/* 2. Details Column */}
                <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5">
                  <div>
                    {/* Header line: Disc Name & Equipped badge */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                        {disc.name}
                      </span>
                      {equippedIn && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                          {equippedIn}
                        </span>
                      )}
                    </div>

                    {/* Tags / Trekkers */}
                    {(disc.tag?.length || disc.char?.length) && (
                      <div className="flex items-center gap-1 flex-wrap mt-0.5 text-[11px] text-slate-500 dark:text-white/70">
                        {disc.tag?.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded bg-surface-subtle border border-border-subtle dark:text-white/80"
                          >
                            {t}
                          </span>
                        ))}
                        {disc.char?.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 3. Bigger Notes Display */}
                    {activeSlot.kind === 'support' ? (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {Object.entries(maxSupportNotes).map(([noteName, val]) => {
                          const meta = NOTE_BY_NAME[noteName as keyof typeof NOTE_BY_NAME];
                          return (
                            <span
                              key={noteName}
                              className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 py-px rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 shadow-xs"
                            >
                              {meta && (
                                <img
                                  src={getNoteIconUrl(meta.id)}
                                  alt={meta.name}
                                  className="size-5 sm:size-6 object-contain drop-shadow shrink-0"
                                />
                              )}
                              <span>
                                {meta?.shortName || noteName}{' '}
                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                  +{val}
                                </span>
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {harmonyNoteNames.length > 0 ? (
                          <>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-white/70 shrink-0">
                              Harmony:
                            </span>
                            {harmonyNoteNames.map((n) => {
                              const meta = NOTE_BY_NAME[n as keyof typeof NOTE_BY_NAME];
                              return meta ? (
                                <div
                                  key={n}
                                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-md bg-amber-500/10 border border-amber-500/25 shadow-xs"
                                  title={meta.name}
                                >
                                  <img
                                    src={getNoteIconUrl(meta.id)}
                                    alt={meta.shortName}
                                    className="size-5 sm:size-6 object-contain drop-shadow shrink-0"
                                  />
                                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                    {meta.shortName}
                                  </span>
                                </div>
                              ) : null;
                            })}
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-white/60 italic">No harmony notes required</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer stats: Lv90 stats */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle text-[11px] text-slate-600 dark:text-white/80">
                    <span className="font-mono font-medium">
                      ATK {disc.stats.lv90.ATK}
                      {Object.entries(disc.stats.lv90)
                        .filter(([k]) => k !== 'ATK' && k !== 'HP')
                        .map(([k, v]) => ` • ${k} ${v}`)
                        .join('')}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-white/70">Lv90 Max</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Hover Message Bubble for Disc Effects */}
      {hoveredDisc && hoveredDisc.targetRect && (() => {
        const disc = hoveredDisc.disc;
        const rect = hoveredDisc.targetRect;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

        // Determine whether disc is in the left or right column
        const cardCenterX = rect.left + rect.width / 2;
        const isLeftColumn = cardCenterX < windowWidth / 2;

        const popupWidth = Math.min(390, windowWidth - 24);
        const cardCenterY = rect.top + rect.height / 2;

        // Position on the side: left side for disc on the left, right side for disc on the right
        const side: 'left' | 'right' = isLeftColumn ? 'left' : 'right';
        let popupLeft: number;

        if (windowWidth < 768) {
          popupLeft = Math.max(8, (windowWidth - popupWidth) / 2);
        } else if (side === 'left') {
          // Disc is in the left column -> popup appears on the left side
          const idealLeft = rect.left - popupWidth - 12;
          popupLeft = Math.max(12, idealLeft);
        } else {
          // Disc is in the right column -> popup appears on the right side
          const idealLeft = rect.right + 12;
          popupLeft = Math.min(windowWidth - popupWidth - 12, idealLeft);
        }

        // Vertically centered at the middle height of the viewport so it shows all effects
        const cardCenterOffset = Math.round(cardCenterY - windowHeight / 2);

        return (
          <div
            onMouseEnter={() => {
              if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
              }
            }}
            onMouseLeave={() => {
              if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
              closeTimerRef.current = setTimeout(() => {
                setHoveredDisc(null);
              }, 200);
            }}
            className="fixed z-[80] pointer-events-auto transition-opacity duration-150 animate-modal-in"
            style={{
              left: `${popupLeft}px`,
              top: '50%',
              transform: 'translateY(-50%)',
              width: `${popupWidth}px`,
              maxHeight: 'calc(100vh - 32px)',
            }}
          >
            {/* Invisible hover bridge to eliminate gap between card and popup */}
            {side === 'left' ? (
              <div className="absolute -right-5 top-0 bottom-0 w-6 pointer-events-auto" />
            ) : (
              <div className="absolute -left-5 top-0 bottom-0 w-6 pointer-events-auto" />
            )}

            <div className="disc-card relative">
              <DiscDetailCard key={disc.id} disc={disc} slotKind={activeSlot.kind} />
              {/* Speech bubble tail pointer pointing toward the hovered disc card */}
              {windowWidth >= 768 && side === 'left' ? (
                <div
                  className="absolute -right-1.5 size-3 rotate-45 border-r border-t border-[var(--dc-panel-border)] bg-[var(--dc-panel)] pointer-events-none"
                  style={{ top: `calc(50% + clamp(-38vh, ${cardCenterOffset}px, 38vh))` }}
                />
              ) : windowWidth >= 768 ? (
                <div
                  className="absolute -left-1.5 size-3 rotate-45 border-l border-b border-[var(--dc-panel-border)] bg-[var(--dc-panel)] pointer-events-none"
                  style={{ top: `calc(50% + clamp(-38vh, ${cardCenterOffset}px, 38vh))` }}
                />
              ) : null}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
