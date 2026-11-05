'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import charactersData from '@/data/characters.json';
import { SSCharacter } from '@/types';
import { calculateAffinityReq } from '@/data/affinity';
import {
  STELLA_SORA_GIFTS,
  GiftAffinityMood,
  isGiftLovedBy,
  getGiftAffinityMood,
  getGiftEffectiveExp,
} from '@/data/gifts';
import { TrekkerSelector } from '@/components/calculator/trekker-selector';
import {
  Heart,
  RotateCcw,
  Sparkles,
  Trash2,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RarityTier = 3 | 4 | 5;

const rarityTheme: Record<
  RarityTier,
  {
    label: string;
    shortLabel: string;
    cardBorder: string;
    cardBg: string;
    badgeStyle: string;
    titleColor: string;
    totalExpColor: string;
    fillBtnStyle: string;
    inputFocus: string;
  }
> = {
  5: {
    label: 'Exquisite Gift',
    shortLabel: 'EXQ',
    cardBorder: 'border-purple-500/30 hover:border-purple-500/50',
    cardBg: 'bg-purple-50',
    badgeStyle: 'bg-purple-500/20 text-purple-700 border-purple-500/40',
    titleColor: 'text-purple-700',
    totalExpColor: 'text-purple-700',
    fillBtnStyle: 'border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700',
    inputFocus: 'focus:border-purple-500',
  },
  4: {
    label: 'Rare Gift',
    shortLabel: 'RAR',
    cardBorder: 'border-amber-500/30 hover:border-amber-500/50',
    cardBg: 'bg-amber-50',
    badgeStyle: 'bg-amber-500/20 text-amber-700 border-amber-500/40',
    titleColor: 'text-amber-700',
    totalExpColor: 'text-amber-700',
    fillBtnStyle: 'border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700',
    inputFocus: 'focus:border-amber-500',
  },
  3: {
    label: 'Common Gift',
    shortLabel: 'COM',
    cardBorder: 'border-sky-500/30 hover:border-sky-500/50',
    cardBg: 'bg-sky-50',
    badgeStyle: 'bg-sky-500/20 text-sky-700 border-sky-500/40',
    titleColor: 'text-sky-700',
    totalExpColor: 'text-sky-700',
    fillBtnStyle: 'border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700',
    inputFocus: 'focus:border-sky-500',
  },
};

function AffinityMoodFace({ mood }: { mood: GiftAffinityMood }) {
  if (mood === 'loved') {
    return (
      <div
        className="size-4 sm:size-4.5 rounded-full bg-amber-400 border border-amber-500 shadow-sm flex items-center justify-center shrink-0 select-none ring-1 ring-black/40"
        title="Loved Gift (+50% Affinity EXP)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-2.5 sm:size-3 text-amber-950"
          strokeWidth="2.2"
          stroke="currentColor"
          aria-hidden="true"
        >
          {/* Joyful curved eyes */}
          <path d="M7 9C7.5 7.5 9.5 7.5 10 9" strokeLinecap="round" />
          <path d="M14 9C14.5 7.5 16.5 7.5 17 9" strokeLinecap="round" />
          {/* Big happy smile */}
          <path
            d="M7.5 13C8.5 17 15.5 17 16.5 13"
            fill="currentColor"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (mood === 'disliked') {
    return (
      <div
        className="size-4 sm:size-4.5 rounded-full bg-slate-400 border border-slate-500 shadow-sm flex items-center justify-center shrink-0 select-none ring-1 ring-black/40"
        title="Disliked Gift (-20% Affinity EXP)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-2.5 sm:size-3 text-slate-900"
          strokeWidth="2.2"
          stroke="currentColor"
          aria-hidden="true"
        >
          {/* Dot eyes */}
          <circle cx="8" cy="10" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="16" cy="10" r="1.3" fill="currentColor" stroke="none" />
          {/* Straight flat mouth */}
          <line x1="8" y1="15" x2="16" y2="15" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Neutral (Green face)
  return (
    <div
      className="size-4 sm:size-4.5 rounded-full bg-emerald-400 border border-emerald-500 shadow-sm flex items-center justify-center shrink-0 select-none ring-1 ring-black/40"
      title="Neutral Gift (Standard 1x EXP)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-2.5 sm:size-3 text-emerald-950"
        strokeWidth="2.2"
        stroke="currentColor"
        aria-hidden="true"
      >
        {/* Dot eyes */}
        <circle cx="8" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
        {/* Gentle pleasant smile */}
        <path d="M8 14C9.5 16 14.5 16 16 14" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function BondCalculatorContent() {
  const searchParams = useSearchParams();
  const characters = charactersData as Record<string, SSCharacter>;
  const charList = useMemo(() => Object.values(characters), [characters]);

  // Initial character from query or default to first character
  const initialCharId = searchParams.get('id')
    ? Number(searchParams.get('id'))
    : charList[0]?.id || 103;

  const [selectedCharId, setSelectedCharId] = useState<number>(initialCharId);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const currentExp = 0;
  const [targetLevel, setTargetLevel] = useState<number>(20);

  // Filter tab for the gifts list
  const [giftFilter, setGiftFilter] = useState<'all' | 'favorites' | 5 | 4 | 3>('all');

  // Gift allocated amounts { [giftId]: count }
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});

  const selectedChar = characters[String(selectedCharId)] || charList[0];

  // Calculation results
  const expStats = useMemo(() => {
    return calculateAffinityReq(currentLevel, currentExp, targetLevel);
  }, [currentLevel, currentExp, targetLevel]);

  const favoriteGifts = useMemo(() => {
    return STELLA_SORA_GIFTS.filter((g) => isGiftLovedBy(g, selectedChar.id));
  }, [selectedChar.id]);

  // Total EXP provided by allocated gifts
  const totalExpProvided = useMemo(() => {
    return STELLA_SORA_GIFTS.reduce((sum, gift) => {
      const count = giftCounts[gift.id] || 0;
      if (count <= 0) return sum;
      const effectiveExp = getGiftEffectiveExp(gift, selectedChar.id);
      return sum + count * effectiveExp;
    }, 0);
  }, [giftCounts, selectedChar.id]);

  const overflowExp = Math.max(0, totalExpProvided - expStats.neededExp);
  const remainingExp = Math.max(0, expStats.neededExp - totalExpProvided);

  const progressPct = useMemo(() => {
    if (expStats.neededExp <= 0) return 100;
    return Math.min(100, Math.round((totalExpProvided / expStats.neededExp) * 100));
  }, [totalExpProvided, expStats.neededExp]);

  const totalGiftsCount = useMemo(() => {
    return Object.values(giftCounts).reduce((sum, c) => sum + (c || 0), 0);
  }, [giftCounts]);

  const daysNeeded = Math.ceil(totalGiftsCount / 10);

  // Stepper handlers
  const updateGiftCount = (giftId: string, amount: number) => {
    const valid = Math.max(0, Math.floor(amount || 0));
    setGiftCounts((prev) => ({
      ...prev,
      [giftId]: valid,
    }));
  };

  const autoFillFavorites = () => {
    if (favoriteGifts.length === 0 || expStats.neededExp <= 0) return;
    let accumulated = 0;
    const newCounts: Record<string, number> = {};
    for (const gift of favoriteGifts) {
      const exp = getGiftEffectiveExp(gift, selectedChar.id);
      const needed = Math.max(0, expStats.neededExp - accumulated);
      if (needed <= 0) break;
      const count = Math.ceil(needed / exp);
      newCounts[gift.id] = count;
      accumulated += count * exp;
      break;
    }
    setGiftCounts(newCounts);
  };

  // Filtered gifts to display
  const displayedGifts = useMemo(() => {
    if (giftFilter === 'favorites') {
      return favoriteGifts.length > 0 ? favoriteGifts : STELLA_SORA_GIFTS;
    }
    if (giftFilter === 'all') {
      return STELLA_SORA_GIFTS;
    }
    return STELLA_SORA_GIFTS.filter((g) => g.rarity === giftFilter);
  }, [giftFilter, favoriteGifts]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-foreground">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Affinity Calculator
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Calculate the exact Affinity EXP required to level up your Trekkers' affinity level and customize gift allocations.
          </p>
        </div>
      </div>

      {/* Main Grid: 5 cols left (Trekker & Level Steppers), 7 cols right (Progress & Gifts Window) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Columns: Trekker Card & Milestone Stepper */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Trekker Selector Showcase Card */}
          <TrekkerSelector
            selectedId={String(selectedCharId)}
            onSelect={(id) => setSelectedCharId(Number(id))}
          />

          {/* Affinity Milestone Levels Card */}
          <div className="p-5 rounded-2xl border border-border bg-surface-card celestial-card flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base !text-slate-900">
                  Affinity Milestone
                </span>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30 tabular-nums">
                Lv. {currentLevel} &rarr; Lv. {targetLevel}
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Current Level</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentLevel((prev) => Math.max(1, prev - 1))}
                      disabled={currentLevel <= 1}
                      aria-label="Decrease current level"
                      className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
                    >
                      <Minus className="size-3" aria-hidden="true" />
                    </button>
                    <span className="font-mono text-slate-900 font-bold w-8 text-center tabular-nums">Lv. {currentLevel}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(98, currentLevel + 1);
                        setCurrentLevel(next);
                        if (next >= targetLevel) setTargetLevel(next + 1);
                      }}
                      disabled={currentLevel >= 98}
                      aria-label="Increase current level"
                      className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={98}
                  value={currentLevel}
                  aria-label="Current level slider"
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCurrentLevel(val);
                    if (val >= targetLevel) setTargetLevel(val + 1);
                  }}
                  className="w-full celestial-slider focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                />
              </div>

              <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Target Level</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTargetLevel((prev) => Math.max(currentLevel + 1, prev - 1))}
                      disabled={targetLevel <= currentLevel + 1}
                      aria-label="Decrease target level"
                      className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
                    >
                      <Minus className="size-3" aria-hidden="true" />
                    </button>
                    <span className="font-mono text-slate-900 font-bold w-8 text-center tabular-nums">Lv. {targetLevel}</span>
                    <button
                      type="button"
                      onClick={() => setTargetLevel((prev) => Math.min(99, prev + 1))}
                      disabled={targetLevel >= 99}
                      aria-label="Increase target level"
                      className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
                    >
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={currentLevel + 1}
                  max={99}
                  value={targetLevel}
                  aria-label="Target level slider"
                  onChange={(e) => setTargetLevel(Number(e.target.value))}
                  className="w-full celestial-slider focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                />
              </div>

              {/* Quick Milestones */}
              <div className="pt-1">
                <span className="text-xs font-medium text-slate-600 block mb-2">
                  Quick Milestone Targets
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[5, 10, 20, 30, 50, 70, 99].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        if (lvl > currentLevel) setTargetLevel(lvl);
                      }}
                      className={cn(
                        'py-1 rounded-md text-xs font-mono font-medium border transition-colors cursor-pointer text-center press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                        targetLevel === lvl
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                          : 'bg-surface-elevated text-slate-700 border-border hover:text-slate-900 hover:border-slate-400'
                      )}
                    >
                      Lv. {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Calculation Outputs & Gifts Window */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Progress Card (Required Affinity EXP Window) */}
          <div className="p-5 rounded-2xl border border-border bg-surface-card celestial-card flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-600 font-medium">
                  Required Affinity EXP
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  {remainingExp === 0 ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold text-emerald-600 font-mono">
                        Target Met
                      </span>
                      {overflowExp > 0 && (
                        <span className="text-xs text-emerald-600/80 font-mono tabular-nums">
                          (+{overflowExp.toLocaleString()} EXP overflow)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums">
                        {remainingExp.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-600">points remaining</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs font-mono bg-base px-3 py-2 rounded-lg border border-border">
                <span className="text-slate-600 block text-xs">Current</span>
                <strong className={cn('font-bold tabular-nums', totalExpProvided >= expStats.neededExp ? 'text-emerald-600' : 'text-slate-800')}>
                  {totalExpProvided.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Progress Bar (Composite-only scaleX transform) */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-base overflow-hidden border border-border">
                <div
                  className={cn(
                    'h-full w-full origin-left transition-transform duration-300',
                    progressPct >= 100
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  )}
                  style={{ transform: `scaleX(${progressPct / 100})` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-600 font-mono">
                <span>Lv. {currentLevel}</span>
                <span className={cn('font-semibold tabular-nums', progressPct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
                  {progressPct}% Complete
                </span>
                <span>Lv. {targetLevel}</span>
              </div>
            </div>
          </div>

          {/* Gift Allocation Card */}
          <div className="p-5 rounded-2xl border border-border bg-surface-card celestial-card flex flex-col gap-4">
            {/* Header with Title and Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="font-semibold text-base text-slate-900">
                  Gift Allocation
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Select and allocate gifts to reach your target Affinity EXP
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setGiftCounts({})}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-base text-slate-700 border border-border text-xs font-medium hover:text-slate-900 hover:bg-surface-hover transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                  title="Reset all gift amounts to 0"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Empty All</span>
                </button>
              </div>
            </div>

            {/* Gift Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setGiftFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                  giftFilter === 'all'
                    ? 'bg-slate-100 text-slate-900 border-slate-300'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                <span>All Gifts ({STELLA_SORA_GIFTS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setGiftFilter('favorites')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                  giftFilter === 'favorites'
                    ? 'bg-pink-500/20 text-pink-800 border-pink-500/40 shadow-sm shadow-pink-500/20'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                <Heart className="size-3 fill-pink-400 text-pink-600" aria-hidden="true" />
                <span>Favorites ({favoriteGifts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setGiftFilter(5)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                  giftFilter === 5
                    ? 'bg-purple-500/20 text-purple-800 border-purple-500/40'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                <span>5★ Exquisite Gift</span>
              </button>
              <button
                type="button"
                onClick={() => setGiftFilter(4)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                  giftFilter === 4
                    ? 'bg-amber-500/20 text-amber-800 border-amber-500/40'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                <span>4★ Rare Gift</span>
              </button>
              <button
                type="button"
                onClick={() => setGiftFilter(3)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                  giftFilter === 3
                    ? 'bg-sky-500/20 text-sky-800 border-sky-500/40'
                    : 'bg-base text-slate-600 border-border hover:text-slate-900'
                )}
              >
                <span>3★ Common Gift</span>
              </button>
            </div>

            {/* Grid of Gifts */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {displayedGifts.map((gift) => {
                const effectiveExp = getGiftEffectiveExp(gift, selectedChar.id);
                const mood: GiftAffinityMood = getGiftAffinityMood(gift, selectedChar.id);
                const count = giftCounts[gift.id] || 0;
                const theme = rarityTheme[gift.rarity];

                return (
                  <div
                    key={gift.id}
                    className={cn(
                      'flex flex-col items-center p-1.5 rounded-lg border transition-colors bg-base relative group select-none',
                      count > 0 ? 'border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30' : 'border-border hover:border-slate-400'
                    )}
                    title={`${gift.name} (${gift.rarity}★) • +${effectiveExp.toLocaleString()} EXP`}
                  >
                    {/* Picture of the Gift as an accessible button */}
                    <button
                      type="button"
                      onClick={() => updateGiftCount(gift.id, count + 1)}
                      aria-label={`Select ${gift.name} to increase amount`}
                      className={cn(
                        'relative aspect-square w-full rounded-md border flex items-center justify-center overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400',
                        theme.badgeStyle
                      )}
                    >
                      <img
                        src={gift.imageUrl}
                        alt={gift.name}
                        width={64}
                        height={64}
                        loading="lazy"
                        className="size-full object-contain p-1.5 drop-shadow"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== gift.fallbackUrl) {
                            target.src = gift.fallbackUrl;
                          }
                        }}
                      />

                      {/* Top Right of Gift Image: Loved / Neutral / Disliked */}
                      <div className="absolute top-1 right-1 z-10 pointer-events-none">
                        <AffinityMoodFace mood={mood} />
                      </div>

                      {/* Bottom Right: Compact Rarity Star Pill */}
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-black/85 text-amber-300 border border-white/20 leading-none pointer-events-none">
                        {gift.rarity}★
                      </span>
                    </button>

                    {/* Stepper Controls */}
                    <div className="flex items-center justify-between w-full mt-1.5 bg-surface border border-border rounded-md p-0.5">
                      <button
                        type="button"
                        aria-label="Decrease"
                        onClick={() => updateGiftCount(gift.id, Math.max(0, count - 1))}
                        disabled={count === 0}
                        title={`Decrease ${gift.name}`}
                        className="size-6 rounded flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-1 focus-visible:ring-amber-400"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min={0}
                        value={count}
                        onChange={(e) =>
                          updateGiftCount(gift.id, Math.max(0, parseInt(e.target.value) || 0))
                        }
                        aria-label={`${gift.name} count`}
                        className="w-8 text-center font-mono font-bold text-xs bg-transparent text-slate-900 focus-visible:ring-1 focus-visible:ring-amber-400 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      <button
                        type="button"
                        aria-label="Increase"
                        onClick={() => updateGiftCount(gift.id, count + 1)}
                        title={`Increase ${gift.name}`}
                        className="size-6 rounded flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-amber-400"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Days required counter based on 10 gifts/day Heartlink Mail limit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-slate-600">
                <span>Days needed to send all gifts (10 gifts/day limit):</span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-600 text-xs">
                  ({totalGiftsCount} {totalGiftsCount === 1 ? 'gift' : 'gifts'}) &rarr;
                </span>
                <strong className="text-sm font-bold text-amber-600 tabular-nums">
                  {daysNeeded} {daysNeeded === 1 ? 'day' : 'days'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BondCalculatorPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-slate-600">Loading Bond Calculator…</div>}>
      <BondCalculatorContent />
    </Suspense>
  );
}
