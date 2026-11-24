'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Disc,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { getDiscOutfitIconUrl } from '@/data/notes';
import {
  computeEstimatedDiscRankings,
  DEFAULT_DISC_RANKING_ASSUMPTIONS,
  type BaselineContextMode,
  type BaselineDupePreset,
  type CompareBaseline,
  type DiscRankingAssumptions,
  type DiscRankingContext,
  type EmblemBaselineMode,
  type EnemyResPreset,
  type FightMode,
  type NotesMode,
  type PotentialLevelMode,
  type SlicedPotentialEntry,
  type UptimeMode,
} from '@/lib/calculator/disc-rankings-client';
import type { SlotKey } from '@/lib/calculator/fighter-calc';
import {
  computeEstimatedEmblemRankings,
  computeEstimatedPotentialRankings,
  computeEstimatedSkillPlus3Matrix,
  computeEstimatedTalentRankings,
  type EstimatedEmblemColumn,
} from '@/lib/calculator/potential-emblem-rankings';
import {
  deriveProfileFromRotation,
  hasActiveRotationEntries,
  type BuildRotation,
} from '@/lib/calculator/build-rotation';
import { RotationEditorPanel } from './rotation-editor-panel';
import type {
  CommunityBuildAnalytics,
  DiscRankRow,
  EmblemColumn,
  SkillHighlightTone,
  SkillPlus3Variant,
} from '@/lib/community-analytics-utils';
import {
  getHeatmapStyle,
  getSlotRoleDotClass,
  getSlotRoleTintStyle,
} from '@/lib/community-analytics-utils';
import { getDiscSlug } from '@/lib/disc-utils';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';

type AnalyticsTabId = 'all' | 'discs' | 'potentials' | 'emblems' | 'talents';
type DiscDupeFilter = 'all' | 'C1' | 'C6';
type SourceChoice = 'sheet' | 'estimated';

function normalizePotName(name: string): string {
  return name.toLowerCase().trim().replace(/\s*\+\d+$/, '');
}

function formatSignedPct2(value: number, signed: boolean): string {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  if (!signed) return `${normalized.toFixed(2)}%`;
  if (normalized > 0) return `+${normalized.toFixed(2)}%`;
  if (normalized < 0) return `${normalized.toFixed(2)}%`;
  return '0.00%';
}

function SourceSwitcher({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: SourceChoice;
  onChange: (next: SourceChoice) => void;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center p-0.5 rounded-lg border border-border bg-surface-subtle"
    >
      {(
        [
          { id: 'sheet', label: 'ZiLenTz' },
          { id: 'estimated', label: 'Estimated' },
        ] as const
      ).map((src) => (
        <button
          key={src.id}
          type="button"
          aria-pressed={value === src.id}
          onClick={() => onChange(src.id)}
          className={cn(
            'px-2 py-0.5 rounded-md text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
            value === src.id
              ? 'bg-surface-card text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {src.label}
        </button>
      ))}
    </div>
  );
}

function SegmentedGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; title?: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-slate-600 dark:text-white/75">
        {label}
      </div>
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              title={opt.title}
              onClick={() => onChange(opt.id)}
              className={cn(
                'px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                active
                  ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold'
                  : 'bg-surface-card border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
              )}
            >
              <span className="block max-w-[160px] truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SKILL_HIGHLIGHT_CLASSES: Record<SkillHighlightTone, string> = {
  rose: 'bg-rose-500/18 dark:bg-rose-500/24 font-bold',
  violet: 'bg-violet-500/18 dark:bg-violet-500/24 font-bold',
  cyan: 'bg-cyan-500/18 dark:bg-cyan-500/24 font-bold',
};

function formatPct2(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatPct1(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDamageInt(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function filterDiscRows(rows: DiscRankRow[], filter: DiscDupeFilter): DiscRankRow[] {
  if (filter === 'all') return rows;
  if (filter === 'C6') return rows.filter((r) => r.dupe === 'C6');
  return rows.filter((r) => r.dupe === 'C1' || r.dupe === 'Base');
}

const INITIAL_DISC_ROWS = 15;

function DiscRankingTable({
  title,
  metricLabel,
  rows,
}: {
  title: string;
  metricLabel: string;
  rows: DiscRankRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const isDeltaMode = metricLabel === 'vs Equipped';
  const maxVal = useMemo(
    () => rows.reduce((max, r) => (r.value > max ? r.value : max), 0),
    [rows]
  );
  const hasMore = rows.length > INITIAL_DISC_ROWS;
  const visibleRows = hasMore && !expanded ? rows.slice(0, INITIAL_DISC_ROWS) : rows;

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <div
        className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        tabIndex={0}
        role="region"
        aria-label={`${title} rankings table`}
      >
        <table className="w-full min-w-[340px] border-collapse text-xs sm:text-[13px]">
          <thead>
            <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
              <th colSpan={3} className="px-3 py-2 text-center font-bold tracking-wide">
                {title}
              </th>
            </tr>
            <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                Name
              </th>
              <th scope="col" className="px-2.5 py-1.5 text-center font-semibold w-20">
                Dupe
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold w-28">
                {metricLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-600 dark:text-white/70">
                  No entries match this dupe filter.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => {
                const isC6 = row.dupe === 'C6';
                const normalized = Math.abs(row.value) < 0.005 ? 0 : row.value;
                const isNegative = isDeltaMode && normalized < 0;
                const isZeroDelta = isDeltaMode && normalized === 0;
                const heatStyle =
                  normalized > 0 ? getHeatmapStyle(normalized, maxVal, 'emerald') : undefined;
                return (
                  <tr
                    key={`${row.name}-${row.dupe}-${idx}`}
                    className={cn(
                      'transition-colors hover:bg-surface-hover/70',
                      isC6 && 'bg-rose-500/8 dark:bg-rose-500/12'
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        'px-3 py-1.5 text-left text-slate-900 dark:text-white',
                        row.isBaseline ? 'font-bold' : 'font-medium'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {row.discId ? (
                          <img
                            src={getDiscOutfitIconUrl(row.discId, 'full')}
                            alt=""
                            width={24}
                            height={24}
                            loading="lazy"
                            decoding="async"
                            className="size-6 rounded object-cover shrink-0 border border-border-subtle bg-base"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="size-6 rounded border border-dashed border-border-subtle bg-surface-subtle/70 flex items-center justify-center shrink-0"
                          >
                            <Disc className="size-3.5 text-slate-500 dark:text-white/45" />
                          </span>
                        )}

                        {row.discId ? (
                          <Link
                            href={`/discs/${getDiscSlug(row.name)}`}
                            className="truncate hover:underline text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <span className="truncate">{row.name}</span>
                        )}

                        {row.isBaseline && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded border border-amber-500/35 bg-amber-500/15 text-[11px] font-bold leading-none text-amber-800">
                            {isDeltaMode ? 'Equipped' : 'Baseline'}
                          </span>
                        )}
                      </div>
                    </th>
                    <td
                      className={cn(
                        'px-2.5 py-1.5 text-center tabular-nums text-xs text-slate-800 dark:text-white/90',
                        row.isBaseline && 'font-bold'
                      )}
                    >
                      {row.dupe}
                    </td>
                    <td
                      style={heatStyle}
                      className={cn(
                        'px-3 py-1.5 text-right tabular-nums',
                        isNegative
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          : isZeroDelta
                            ? 'bg-surface-subtle/80 text-slate-700 dark:text-white/85'
                            : 'text-slate-900 dark:text-white',
                        row.isBaseline ? 'font-bold' : 'font-semibold'
                      )}
                    >
                      {formatSignedPct2(row.value, isDeltaMode)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="border-t border-border bg-surface-subtle/60 px-3 py-1.5 text-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-slate-700 dark:text-white/85 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>
              {expanded ? 'Show less' : `Show more (${rows.length - INITIAL_DISC_ROWS})`}
            </span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 transition-transform duration-150',
                expanded && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </div>
  );
}

interface PotRankDisplayRow {
  potentialId?: number;
  name: string;
  slot?: SlotKey;
  characterId?: number;
  characterName?: string;
  baseLevel?: number;
  value: number | null;
  kind: SlicedPotentialEntry['kind'];
}

interface PotPlus3DisplayRow {
  potentialId?: number;
  name: string;
  slot?: SlotKey;
  characterId?: number;
  characterName?: string;
  baseLevel?: number;
  upgradedLevel?: number;
  teamDmg: number | null;
  personalDmg: number | null;
  kind: SlicedPotentialEntry['kind'];
  isRecommended?: boolean;
  separatorBefore?: boolean;
}

export interface BuildAnalyticsSectionProps {
  analytics?: CommunityBuildAnalytics | null;
  discRankingContext?: DiscRankingContext | null;
  activeInspectedPotentialId?: number | null;
  onInspectPotential?: (potentialId: number, level: number, anchorRect: DOMRect) => void;
  activeRotation?: BuildRotation | null;
  rotationOrigin?: 'auto' | 'preset' | 'local';
  canEditRotation?: boolean;
  onRotationChange?: (next: BuildRotation | null) => void;
  onSaveAndCustomize?: () => void;
}

export function BuildAnalyticsSection({
  analytics,
  discRankingContext,
  activeInspectedPotentialId,
  onInspectPotential,
  activeRotation = null,
  rotationOrigin = 'auto',
  canEditRotation = false,
  onRotationChange,
  onSaveAndCustomize,
}: BuildAnalyticsSectionProps) {
  const effectiveContext = useMemo<DiscRankingContext | null>(() => {
    if (!discRankingContext) return null;
    if (!hasActiveRotationEntries(activeRotation)) return discRankingContext;
    const derivedProfile = deriveProfileFromRotation(activeRotation!, discRankingContext.roster);
    const totalWeight = (['vanguard', 'versatile', 'support'] as const).reduce(
      (sum, s) =>
        sum + (derivedProfile.slots[s] ?? []).reduce((acc, sl) => acc + sl.weight, 0),
      0
    );
    const summarySlots = (['vanguard', 'versatile', 'support'] as const)
      .map((slot) => {
        const entry = discRankingContext.roster.find((r) => r.slot === slot);
        if (!entry?.character) return null;
        const slices = derivedProfile.slots[slot] ?? [];
        const slotWeight = slices.reduce((acc, sl) => acc + sl.weight, 0);
        const sharePct = totalWeight > 0 ? Math.round((slotWeight / totalWeight) * 100) : 0;
        const topTypes = slices
          .slice()
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2)
          .map((sl) => sl.type);
        return {
          slot,
          characterId: entry.character.id,
          characterName: entry.character.name.EN,
          sharePct,
          topTypes,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    const primaryDamageType =
      derivedProfile.slots[derivedProfile.carrySlot]?.[0]?.type ?? 'Skill';
    return {
      ...discRankingContext,
      combatRotation: activeRotation!,
      profile: derivedProfile,
      profileSummary: {
        carrySlot: derivedProfile.carrySlot,
        primaryDamageType,
        slots: summarySlots,
      },
    };
  }, [discRankingContext, activeRotation]);

  const hasSheetDiscs = Boolean(analytics?.discRankings);
  const hasEstimatedDiscs = Boolean(effectiveContext);

  const hasSheetPotRank = Boolean(analytics?.potRank && analytics.potRank.length > 0);
  const hasSheetPotPlus3 = Boolean(analytics?.potPlus3 && analytics.potPlus3.length > 0);
  const hasSheetSkillPlus3 = Boolean(analytics?.skillPlus3 && analytics.skillPlus3.length > 0);
  const hasEstimatedSkillPlus3 = Boolean(effectiveContext);
  const hasSheetPotentials = hasSheetPotRank || hasSheetPotPlus3;
  const hasEstimatedPotentials = Boolean(
    effectiveContext?.potentials && effectiveContext.potentials.length > 0
  );

  const hasSheetEmblems = Boolean(analytics?.emblems && analytics.emblems.length > 0);
  const hasEstimatedEmblems = Boolean(effectiveContext);
  const hasSheetTalents = Boolean(analytics?.talents && analytics.talents.length > 0);
  const hasEstimatedTalents = Boolean(effectiveContext);
  const hasTalentsSection = hasSheetTalents || hasEstimatedTalents;

  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('all');
  const [dupeFilter, setDupeFilter] = useState<DiscDupeFilter>('all');
  const [discSource, setDiscSource] = useState<SourceChoice>(
    hasSheetDiscs ? 'sheet' : 'estimated'
  );
  const [skillSource, setSkillSource] = useState<SourceChoice>(
    hasSheetSkillPlus3 ? 'sheet' : 'estimated'
  );
  const [potSource, setPotSource] = useState<SourceChoice>(
    hasSheetPotentials ? 'sheet' : 'estimated'
  );
  const [emblemSource, setEmblemSource] = useState<SourceChoice>(
    hasSheetEmblems ? 'sheet' : 'estimated'
  );
  const [talentSource, setTalentSource] = useState<SourceChoice>(
    hasSheetTalents ? 'sheet' : 'estimated'
  );
  const [selectedTrekkerSlot, setSelectedTrekkerSlot] = useState<SlotKey | 'all'>('all');
  const [assumptions, setAssumptions] = useState<DiscRankingAssumptions>(
    DEFAULT_DISC_RANKING_ASSUMPTIONS
  );
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const effectiveDiscSource: SourceChoice =
    discSource === 'sheet' && hasSheetDiscs
      ? 'sheet'
      : hasEstimatedDiscs
        ? 'estimated'
        : 'sheet';

  const effectiveSkillSource: SourceChoice =
    skillSource === 'sheet' && hasSheetSkillPlus3
      ? 'sheet'
      : hasEstimatedSkillPlus3
        ? 'estimated'
        : 'sheet';

  const effectivePotSource: SourceChoice =
    potSource === 'sheet' && hasSheetPotentials
      ? 'sheet'
      : hasEstimatedPotentials
        ? 'estimated'
        : 'sheet';

  const effectiveEmblemSource: SourceChoice =
    emblemSource === 'sheet' && hasSheetEmblems
      ? 'sheet'
      : hasEstimatedEmblems
        ? 'estimated'
        : 'sheet';

  const effectiveTalentSource: SourceChoice =
    talentSource === 'sheet' && hasSheetTalents
      ? 'sheet'
      : hasEstimatedTalents
        ? 'estimated'
        : 'sheet';

  const hasAnyDiscs = hasSheetDiscs || hasEstimatedDiscs;
  const hasAnySkillPlus3 = hasSheetSkillPlus3 || hasEstimatedSkillPlus3;
  const hasAnyPotentialsSection =
    hasAnySkillPlus3 || hasSheetPotentials || hasEstimatedPotentials;
  const hasAnyEmblemsSection = hasSheetEmblems || hasEstimatedEmblems;
  const hasSheetAnalytics = Boolean(
    hasSheetDiscs || hasSheetSkillPlus3 || hasSheetPotentials || hasSheetEmblems || hasTalentsSection
  );

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: AnalyticsTabId; label: string }> = [
      { id: 'all', label: 'All' },
    ];
    if (hasAnyDiscs) {
      tabs.push({ id: 'discs', label: 'Discs' });
    }
    if (hasAnyPotentialsSection) {
      tabs.push({
        id: 'potentials',
        label: hasAnySkillPlus3 ? 'Potentials & Skill +3' : 'Potentials',
      });
    }
    if (hasAnyEmblemsSection) {
      tabs.push({ id: 'emblems', label: 'Emblems' });
    }
    if (hasTalentsSection) {
      tabs.push({ id: 'talents', label: 'Talents' });
    }
    return tabs;
  }, [
    hasAnyDiscs,
    hasAnyPotentialsSection,
    hasAnySkillPlus3,
    hasAnyEmblemsSection,
    hasTalentsSection,
  ]);

  const effectiveTab: AnalyticsTabId = availableTabs.some((t) => t.id === activeTab)
    ? activeTab
    : 'all';

  const showDiscs = hasAnyDiscs && (effectiveTab === 'all' || effectiveTab === 'discs');
  const showPotentials =
    hasAnyPotentialsSection && (effectiveTab === 'all' || effectiveTab === 'potentials');
  const showEmblems =
    hasAnyEmblemsSection && (effectiveTab === 'all' || effectiveTab === 'emblems');
  const showTalents =
    hasTalentsSection && (effectiveTab === 'all' || effectiveTab === 'talents');

  const isEstimatedDiscActive = showDiscs && effectiveDiscSource === 'estimated';
  const isEstimatedSkillActive =
    showPotentials && hasEstimatedSkillPlus3 && effectiveSkillSource === 'estimated';
  const isEstimatedPotActive =
    showPotentials &&
    hasEstimatedPotentials &&
    (effectivePotSource === 'estimated' || (effectivePotSource === 'sheet' && !hasSheetPotPlus3));
  const isEstimatedEmblemActive =
    showEmblems && hasEstimatedEmblems && effectiveEmblemSource === 'estimated';
  const isEstimatedTalentActive =
    showTalents && hasEstimatedTalents && effectiveTalentSource === 'estimated';
  const anyEstimatedVisible =
    isEstimatedDiscActive ||
    isEstimatedSkillActive ||
    isEstimatedPotActive ||
    isEstimatedEmblemActive ||
    isEstimatedTalentActive;

  const estimatedDiscRankings = useMemo(() => {
    if (!effectiveContext || !isEstimatedDiscActive) return null;
    return computeEstimatedDiscRankings(effectiveContext, assumptions);
  }, [effectiveContext, isEstimatedDiscActive, assumptions]);

  const estimatedSkillPlus3 = useMemo(() => {
    if (!effectiveContext || !isEstimatedSkillActive) return null;
    return computeEstimatedSkillPlus3Matrix(effectiveContext, assumptions);
  }, [effectiveContext, isEstimatedSkillActive, assumptions]);

  const activeSkillPlus3Variants = useMemo<SkillPlus3Variant[]>(() => {
    if (effectiveSkillSource === 'sheet' && analytics?.skillPlus3?.length) {
      return analytics.skillPlus3;
    }
    return estimatedSkillPlus3 ? [estimatedSkillPlus3] : [];
  }, [effectiveSkillSource, analytics?.skillPlus3, estimatedSkillPlus3]);

  const estimatedPotentials = useMemo(() => {
    if (!effectiveContext || !isEstimatedPotActive) return null;
    return computeEstimatedPotentialRankings(effectiveContext, assumptions);
  }, [effectiveContext, isEstimatedPotActive, assumptions]);

  const estimatedEmblems = useMemo(() => {
    if (!effectiveContext || !isEstimatedEmblemActive) return null;
    return computeEstimatedEmblemRankings(effectiveContext, assumptions);
  }, [effectiveContext, isEstimatedEmblemActive, assumptions]);

  const estimatedTalents = useMemo(() => {
    if (!effectiveContext || !isEstimatedTalentActive) return null;
    return computeEstimatedTalentRankings(effectiveContext, assumptions);
  }, [effectiveContext, isEstimatedTalentActive, assumptions]);

  const activeTalents =
    effectiveTalentSource === 'sheet'
      ? analytics?.talents ?? []
      : estimatedTalents ?? [];

  const potMetaByName = useMemo(() => {
    const map = new Map<
      string,
      {
        potentialId: number;
        slot: SlotKey;
        characterId: number;
        characterName: string;
        baseLevel: number;
        upgradedLevel: number;
        kind: SlicedPotentialEntry['kind'];
      }
    >();
    const isLv6 = assumptions.potentialLevelMode === 'lv6';
    for (const p of effectiveContext?.potentials ?? []) {
      const baseLevel = isLv6 ? Math.min(p.maxLevel, 6) : p.presetLevel;
      map.set(normalizePotName(p.name), {
        potentialId: p.potentialId,
        slot: p.slot,
        characterId: p.characterId,
        characterName: p.characterName,
        baseLevel,
        upgradedLevel: Math.min(p.maxLevel, baseLevel + 3),
        kind: p.kind,
      });
    }
    return map;
  }, [effectiveContext?.potentials, assumptions.potentialLevelMode]);

  const rosterTrekkers = useMemo(() => {
    if (!effectiveContext?.roster) return [];
    const order: SlotKey[] = ['vanguard', 'versatile', 'support'];
    return order
      .map((slot) => effectiveContext.roster.find((r) => r.slot === slot))
      .filter(
        (entry): entry is NonNullable<typeof entry> & { character: NonNullable<NonNullable<typeof entry>['character']> } =>
          Boolean(entry?.character)
      );
  }, [discRankingContext?.roster]);

  const potRankRows = useMemo<PotRankDisplayRow[]>(() => {
    if (effectivePotSource === 'sheet' && hasSheetPotRank && analytics?.potRank) {
      return analytics.potRank.map((r) => {
        const meta = potMetaByName.get(normalizePotName(r.name));
        return {
          potentialId: meta?.potentialId,
          name: r.name,
          slot: meta?.slot,
          characterId: meta?.characterId,
          characterName: meta?.characterName,
          baseLevel: meta?.baseLevel,
          value: r.value,
          kind: meta?.kind ?? 'stat',
        };
      });
    }
    return (estimatedPotentials?.potRank ?? []).map((r) => ({
      potentialId: r.potentialId,
      name: r.name,
      slot: r.slot,
      characterId: r.characterId,
      characterName: r.characterName,
      baseLevel: r.baseLevel,
      value: r.value,
      kind: r.kind,
    }));
  }, [
    effectivePotSource,
    hasSheetPotRank,
    analytics?.potRank,
    potMetaByName,
    estimatedPotentials?.potRank,
  ]);

  const potPlus3IsEstimatedFallback =
    effectivePotSource === 'sheet' && !hasSheetPotPlus3 && hasEstimatedPotentials;

  const potPlus3Rows = useMemo<PotPlus3DisplayRow[]>(() => {
    if (effectivePotSource === 'sheet' && hasSheetPotPlus3 && analytics?.potPlus3) {
      return analytics.potPlus3.map((r) => {
        const meta = potMetaByName.get(normalizePotName(r.name));
        return {
          potentialId: meta?.potentialId,
          name: r.name,
          slot: meta?.slot,
          characterId: meta?.characterId,
          characterName: meta?.characterName,
          baseLevel: meta?.baseLevel,
          upgradedLevel: meta?.upgradedLevel,
          teamDmg: r.teamDmg,
          personalDmg: r.personalDmg,
          kind: meta?.kind ?? 'stat',
          isRecommended: r.isRecommended,
          separatorBefore: r.separatorBefore,
        };
      });
    }
    return (estimatedPotentials?.potPlus3 ?? []).map((r) => ({
      potentialId: r.potentialId,
      name: `${r.name} +3`,
      slot: r.slot,
      characterId: r.characterId,
      characterName: r.characterName,
      baseLevel: r.baseLevel,
      upgradedLevel: r.upgradedLevel,
      teamDmg: r.teamDmg,
      personalDmg: r.personalDmg,
      kind: r.kind,
      isRecommended: r.isRecommended,
    }));
  }, [
    effectivePotSource,
    hasSheetPotPlus3,
    analytics?.potPlus3,
    potMetaByName,
    estimatedPotentials?.potPlus3,
  ]);

  if (availableTabs.length <= 1) {
    return null;
  }

  const activeDiscRankings =
    effectiveDiscSource === 'sheet' ? analytics?.discRankings ?? null : estimatedDiscRankings;

  const filteredMainDiscs = activeDiscRankings
    ? filterDiscRows(activeDiscRankings.main, dupeFilter)
    : [];
  const filteredSupportDiscs = activeDiscRankings
    ? filterDiscRows(activeDiscRankings.support, dupeFilter)
    : [];

  // Scale Potential heatmaps across unfiltered rows so filtering one Trekker keeps absolute heat context
  const potRankMax = potRankRows.reduce(
    (max, r) => (r.value !== null && r.value > max ? r.value : max),
    0
  );
  const potPlus3TeamMax = potPlus3Rows.reduce(
    (max, r) => (r.teamDmg !== null && r.teamDmg > max ? r.teamDmg : max),
    0
  );

  const filteredPotRankRows =
    selectedTrekkerSlot === 'all'
      ? potRankRows
      : potRankRows.filter((r) => r.slot === selectedTrekkerSlot);
  const filteredPotPlus3Rows =
    selectedTrekkerSlot === 'all'
      ? potPlus3Rows
      : potPlus3Rows.filter((r) => r.slot === selectedTrekkerSlot);

  const activeEmblemColumns: Array<EmblemColumn | EstimatedEmblemColumn> =
    effectiveEmblemSource === 'sheet'
      ? analytics?.emblems ?? []
      : estimatedEmblems ?? [];

  const modifiedDrawerCount = (
    [
      assumptions.baselineDupes !== DEFAULT_DISC_RANKING_ASSUMPTIONS.baselineDupes,
      assumptions.baselineContext !== DEFAULT_DISC_RANKING_ASSUMPTIONS.baselineContext,
      assumptions.notesMode !== DEFAULT_DISC_RANKING_ASSUMPTIONS.notesMode,
      assumptions.uptimeMode !== DEFAULT_DISC_RANKING_ASSUMPTIONS.uptimeMode,
      assumptions.enemyRes !== DEFAULT_DISC_RANKING_ASSUMPTIONS.enemyRes,
      assumptions.potentialLevelMode !== DEFAULT_DISC_RANKING_ASSUMPTIONS.potentialLevelMode,
      assumptions.emblemBaseline !== DEFAULT_DISC_RANKING_ASSUMPTIONS.emblemBaseline,
      assumptions.compareBaseline !== DEFAULT_DISC_RANKING_ASSUMPTIONS.compareBaseline,
    ] as const
  ).filter(Boolean).length;
  const hasModifiedAssumptions =
    modifiedDrawerCount > 0 ||
    assumptions.fightMode !== DEFAULT_DISC_RANKING_ASSUMPTIONS.fightMode;

  const compareSlotOptions: ReadonlyArray<{
    id: CompareBaseline;
    label: string;
    title?: string;
  }> = [
    { id: 'empty', label: 'Empty Slot (0%)' },
    ...([0, 1, 2] as const).map((idx) => {
      const slotId = `slot-${idx}` as CompareBaseline;
      const discId = effectiveContext?.mainDiscs[idx]?.discId;
      const discName = discId
        ? effectiveContext?.candidateDiscs[String(discId)]?.name
        : undefined;
      return {
        id: slotId,
        label: discName ? `Slot ${idx + 1}: ${discName}` : `Slot ${idx + 1}`,
        title: discName ? `Compare vs Slot ${idx + 1} (${discName})` : `Compare vs Slot ${idx + 1}`,
      };
    }),
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = availableTabs.findIndex((t) => t.id === effectiveTab);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % availableTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + availableTabs.length) % availableTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = availableTabs.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = availableTabs[nextIdx];
      setActiveTab(nextTab.id);
      document.getElementById(`analytics-tab-${nextTab.id}`)?.focus();
    }
  };

  const anySheetVisible =
    (showDiscs && effectiveDiscSource === 'sheet') ||
    (showPotentials && effectivePotSource === 'sheet') ||
    (showEmblems && effectiveEmblemSource === 'sheet') ||
    (showTalents && effectiveTalentSource === 'sheet');

  return (
    <section
      aria-labelledby="theorycraft-breakdown-heading"
      className="game-card celestial-card p-4 sm:p-6 space-y-5"
    >
      {/* Header & Segmented Tab Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <h2
            id="theorycraft-breakdown-heading"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Theorycraft Breakdown
          </h2>
          {hasSheetAnalytics ? (
            <span className="px-2 py-0.5 rounded-full border border-teal-500/35 bg-teal-500/10 text-xs font-semibold text-teal-700 dark:text-teal-400">
              ZiLenTz
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full border border-amber-500/35 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300">
              Estimated
            </span>
          )}
        </div>

        {availableTabs.length > 2 && (
          <div
            role="tablist"
            aria-label="Theorycraft sections"
            onKeyDown={handleTabKeyDown}
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-border bg-surface-subtle/90 shrink-0"
          >
            {availableTabs.map((tab) => {
              const isSelected = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`analytics-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`analytics-panel-${tab.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                    isSelected
                      ? 'bg-surface-card text-slate-900 dark:text-white border-b-2 border-amber-500'
                      : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover border-b-2 border-transparent'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Calculation Model Summary & Inline Custom Rotation Editor */}
      {effectiveContext && (
        <div className="space-y-2.5">
          {effectiveContext.profileSummary && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-subtle/70 px-3 py-2 text-xs">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full border text-xs font-semibold',
                  hasActiveRotationEntries(activeRotation)
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    : 'border-teal-500/35 bg-teal-500/10 text-teal-800 dark:text-teal-300'
                )}
              >
                {hasActiveRotationEntries(activeRotation) ? 'Custom rotation' : 'Auto-estimated'}
              </span>
              <span className="text-slate-600 dark:text-white/75 tabular-nums">
                {effectiveContext.profileSummary.slots
                  .map(
                    (s) =>
                      `${s.characterName} ${s.sharePct}% (${s.topTypes[0] ?? 'Skill'})`
                  )
                  .join(' · ')}
              </span>
            </div>
          )}

          <RotationEditorPanel
            discRankingContext={effectiveContext}
            activeRotation={activeRotation}
            rotationOrigin={rotationOrigin}
            canEdit={canEditRotation}
            onRotationChange={onRotationChange}
            onSaveAndCustomize={onSaveAndCustomize}
          />
        </div>
      )}

      {/* Unified Shared Assumptions Bar (controls all active Estimated tables) */}
      {effectiveContext && anyEstimatedVisible && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Fight mode"
              >
                {(
                  [
                    { id: 'single', label: 'Boss Blitz' },
                    { id: 'multi', label: 'Mobbing' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={assumptions.fightMode === mode.id}
                    onClick={() =>
                      setAssumptions((prev) => ({
                        ...prev,
                        fightMode: mode.id as FightMode,
                      }))
                    }
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                      assumptions.fightMode === mode.id
                        ? 'bg-amber-500 border-amber-600 text-slate-950'
                        : 'bg-surface-subtle border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-expanded={assumptionsOpen}
                aria-controls="shared-assumptions-panel"
                onClick={() => setAssumptionsOpen((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  assumptionsOpen
                    ? 'bg-surface-elevated border-border-hover text-slate-900 dark:text-white'
                    : 'bg-surface-subtle border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                )}
              >
                <SlidersHorizontal className="size-3 shrink-0" aria-hidden="true" />
                <span>Assumptions</span>
                {modifiedDrawerCount > 0 && (
                  <span className="px-1.5 py-px rounded-full bg-teal-500/15 border border-teal-500/35 text-[11px] tabular-nums leading-none text-teal-700 dark:text-teal-400">
                    {modifiedDrawerCount}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'size-3 shrink-0 transition-transform duration-150',
                    assumptionsOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>

              {hasModifiedAssumptions && (
                <button
                  type="button"
                  onClick={() => setAssumptions(DEFAULT_DISC_RANKING_ASSUMPTIONS)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <RotateCcw className="size-3 shrink-0" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-600 dark:text-white/70">
              Applies to active Estimated tables
            </span>
          </div>

          {assumptionsOpen && (
            <div
              id="shared-assumptions-panel"
              className="rounded-xl border border-border bg-surface-subtle/80 p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
            >
              <SegmentedGroup<BaselineDupePreset>
                label="Baseline Dupes"
                value={assumptions.baselineDupes}
                options={[
                  { id: 'c1-paid-c6-f2p', label: 'C1 Paid / C6 F2P' },
                  { id: 'all-c1', label: 'All C1' },
                  { id: 'all-c6', label: 'All C6' },
                ]}
                onChange={(baselineDupes) =>
                  setAssumptions((prev) => ({ ...prev, baselineDupes }))
                }
              />

              <SegmentedGroup<NotesMode>
                label="Musical Notes"
                value={assumptions.notesMode}
                options={[
                  {
                    id: 'lv1-harmony',
                    label: 'Lv 1 Harmony',
                    title: 'Keep Build Target note stats while locking Disc Harmony skills to Lv 1 (ZiLenTz sheet default)',
                  },
                  { id: 'target', label: 'Build Target' },
                  { id: 'starting', label: 'Starting Only' },
                  { id: 'max-harmony', label: 'Max Harmony' },
                ]}
                onChange={(notesMode) =>
                  setAssumptions((prev) => ({ ...prev, notesMode }))
                }
              />

              <SegmentedGroup<EmblemBaselineMode>
                label="Emblem Baseline"
                value={assumptions.emblemBaseline}
                options={[
                  {
                    id: 'none',
                    label: 'None (0)',
                    title: '0 Emblems baseline (ZiLenTz Summary default)',
                  },
                  {
                    id: 'synthetic',
                    label: 'Loadout Sim',
                    title: 'Simulate typical carry and sub-DPS Emblems in Disc/Potential/Talent baselines',
                  },
                ]}
                onChange={(emblemBaseline) =>
                  setAssumptions((prev) => ({ ...prev, emblemBaseline }))
                }
              />

              <SegmentedGroup<UptimeMode>
                label="Trigger Uptime"
                value={assumptions.uptimeMode}
                options={[
                  { id: 'realistic', label: 'Realistic' },
                  { id: 'ideal', label: 'Ideal 100%' },
                ]}
                onChange={(uptimeMode) =>
                  setAssumptions((prev) => ({ ...prev, uptimeMode }))
                }
              />

              <SegmentedGroup<EnemyResPreset>
                label="Enemy RES"
                value={assumptions.enemyRes}
                options={[
                  { id: 'boss-blitz', label: 'Boss Blitz (250)' },
                  { id: 'neutral', label: 'Neutral 750' },
                  { id: 'low', label: 'Low 0' },
                ]}
                onChange={(enemyRes) =>
                  setAssumptions((prev) => ({ ...prev, enemyRes }))
                }
              />

              <SegmentedGroup<PotentialLevelMode>
                label="Potential Levels"
                value={assumptions.potentialLevelMode}
                options={[
                  { id: 'preset', label: 'Build Preset' },
                  { id: 'lv6', label: 'Uniform Lv 6' },
                ]}
                onChange={(potentialLevelMode) =>
                  setAssumptions((prev) => ({ ...prev, potentialLevelMode }))
                }
              />

              {isEstimatedDiscActive && (
                <>
                  <SegmentedGroup<BaselineContextMode>
                    label="Slot Context (Discs)"
                    value={assumptions.baselineContext}
                    options={[
                      {
                        id: 'equipped',
                        label: 'Team Loadout',
                        title: 'Evaluate alongside the build’s other 2 equipped discs',
                      },
                      {
                        id: 'isolated',
                        label: 'Isolated (Sheet)',
                        title: 'Evaluate in isolation alongside 2x blank off-element discs (sheet style)',
                      },
                    ]}
                    onChange={(baselineContext) =>
                      setAssumptions((prev) => ({
                        ...prev,
                        baselineContext,
                        ...(baselineContext === 'isolated' ? { compareBaseline: 'empty' } : {}),
                      }))
                    }
                  />

                  <div className="md:col-span-2 xl:col-span-3">
                    <SegmentedGroup<CompareBaseline>
                      label="Compare vs. (Discs)"
                      value={assumptions.compareBaseline}
                      options={compareSlotOptions}
                      onChange={(compareBaseline) =>
                        setAssumptions((prev) => ({
                          ...prev,
                          compareBaseline,
                          ...(compareBaseline !== 'empty' ? { baselineContext: 'equipped' } : {}),
                        }))
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Panel Body */}
      <div
        id={`analytics-panel-${effectiveTab}`}
        role="tabpanel"
        aria-labelledby={`analytics-tab-${effectiveTab}`}
        className="space-y-7"
      >
        {/* 1. Disc Rankings */}
        {showDiscs && activeDiscRankings && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Runic Disc Rankings
                </h3>
                {hasSheetDiscs && hasEstimatedDiscs && (
                  <SourceSwitcher
                    ariaLabel="Disc ranking source"
                    value={effectiveDiscSource}
                    onChange={setDiscSource}
                  />
                )}
                <span className="text-xs text-slate-600 dark:text-white/75">
                  ({activeDiscRankings.metricLabel})
                </span>
              </div>

              <div className="flex items-center gap-1" role="group" aria-label="Filter discs by dupe">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'C1', label: 'C1 / Base' },
                    { id: 'C6', label: 'C6' },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    aria-pressed={dupeFilter === pill.id}
                    onClick={() => setDupeFilter(pill.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                      dupeFilter === pill.id
                        ? 'bg-amber-500 border-amber-600 text-slate-950'
                        : 'bg-surface-subtle border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <DiscRankingTable
                title="Main Disc"
                metricLabel={activeDiscRankings.metricLabel}
                rows={filteredMainDiscs}
              />
              <DiscRankingTable
                title="Support Disc"
                metricLabel={activeDiscRankings.metricLabel}
                rows={filteredSupportDiscs}
              />
            </div>
          </div>
        )}

        {/* 2. Potentials & Skill +3 */}
        {showPotentials && (
          <div className="space-y-5">
            {activeSkillPlus3Variants.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Skill +3 Gain Matrix
                  </h3>
                  {hasSheetSkillPlus3 && hasEstimatedSkillPlus3 && (
                    <SourceSwitcher
                      ariaLabel="Skill +3 gain matrix source"
                      value={effectiveSkillSource}
                      onChange={setSkillSource}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {activeSkillPlus3Variants.map((variant, vIdx) => (
                    <div
                      key={`${variant.label}-${vIdx}`}
                      className="overflow-x-auto rounded-xl border border-border bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      tabIndex={0}
                      role="region"
                      aria-label={`Skill +3 matrix (${variant.label})`}
                    >
                      <table className="w-full min-w-[340px] border-collapse text-xs sm:text-[13px]">
                        <thead>
                          <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
                            <th scope="col" className="px-3 py-2 text-center font-bold w-32 border-r border-border">
                              Skill +3
                            </th>
                            <th
                              colSpan={variant.trekkerColumns.length}
                              className="px-3 py-2 text-center font-bold"
                            >
                              {variant.label}
                            </th>
                          </tr>
                          <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
                            <th scope="col" className="px-3 py-1.5 text-left font-semibold border-r border-border">
                              Skill
                            </th>
                            {variant.trekkerColumns.map((col) => (
                              <th
                                key={col.trekkerId}
                                scope="col"
                                className="px-3 py-1.5 text-right font-semibold"
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {variant.rows.map((row) => (
                            <tr key={row.skill} className="hover:bg-surface-hover/50">
                              <th
                                scope="row"
                                className="px-3 py-1.5 text-left font-semibold text-slate-900 dark:text-white border-r border-border-subtle"
                              >
                                {row.skill}
                              </th>
                              {row.cells.map((cell, cIdx) => (
                                <td
                                  key={`${row.skill}-${cIdx}`}
                                  className={cn(
                                    'px-3 py-1.5 text-right tabular-nums text-slate-900 dark:text-white',
                                    cell.highlight && SKILL_HIGHLIGHT_CLASSES[cell.highlight]
                                  )}
                                >
                                  {cell.value !== null ? (
                                    formatPct2(cell.value)
                                  ) : (
                                    <span className="text-slate-400 dark:text-white/35">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(potRankRows.length > 0 || potPlus3Rows.length > 0) && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Potential Value &amp; +3 Scaling
                    </h3>
                    {hasSheetPotentials && hasEstimatedPotentials && (
                      <SourceSwitcher
                        ariaLabel="Potential rankings source"
                        value={effectivePotSource}
                        onChange={setPotSource}
                      />
                    )}
                  </div>

                  {rosterTrekkers.length > 0 && (
                    <div
                      role="group"
                      aria-label="Filter potentials by Trekker"
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <button
                        type="button"
                        aria-pressed={selectedTrekkerSlot === 'all'}
                        onClick={() => setSelectedTrekkerSlot('all')}
                        className={cn(
                          'px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                          selectedTrekkerSlot === 'all'
                            ? 'bg-amber-500 border-amber-600 text-slate-950'
                            : 'bg-surface-subtle border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                        )}
                      >
                        All
                      </button>
                      {rosterTrekkers.map((entry) => {
                        const active = selectedTrekkerSlot === entry.slot;
                        return (
                          <button
                            key={entry.slot}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setSelectedTrekkerSlot((prev) =>
                                prev === entry.slot ? 'all' : entry.slot
                              )
                            }
                            style={active ? getSlotRoleTintStyle(entry.slot) : undefined}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                              active
                                ? 'border-amber-500 text-slate-900 dark:text-white'
                                : 'bg-surface-subtle border-border text-slate-700 dark:text-white/85 hover:bg-surface-hover'
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn('size-2 rounded-full shrink-0', getSlotRoleDotClass(entry.slot))}
                            />
                            <img
                              src={getTrekkerImageUrl(entry.character.id)}
                              alt=""
                              width={18}
                              height={18}
                              className="size-[18px] rounded-full object-cover object-top shrink-0 border border-border-subtle"
                            />
                            <span>{entry.character.name.EN}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    'grid gap-4 items-start',
                    potRankRows.length > 0 && potPlus3Rows.length > 0
                      ? 'grid-cols-1 lg:grid-cols-12'
                      : 'grid-cols-1 max-w-xl'
                  )}
                >
                  {potRankRows.length > 0 && (
                    <div
                      className={cn(
                        'overflow-x-auto rounded-xl border border-border bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        potPlus3Rows.length > 0 ? 'lg:col-span-5' : ''
                      )}
                      tabIndex={0}
                      role="region"
                      aria-label="Potential rank table"
                    >
                      <table className="w-full min-w-[260px] border-collapse text-xs sm:text-[13px]">
                        <thead>
                          <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
                            <th colSpan={2} className="px-3 py-2 text-center font-bold">
                              Potential Rank
                            </th>
                          </tr>
                          <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
                            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                              Name
                            </th>
                            <th scope="col" className="px-3 py-1.5 text-right font-semibold w-28">
                              Dmg Inc
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {filteredPotRankRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={2}
                                className="px-3 py-5 text-center text-slate-600 dark:text-white/70"
                              >
                                No ranked potentials for this Trekker.
                              </td>
                            </tr>
                          ) : (
                            filteredPotRankRows.map((row, idx) => {
                              const isInspected =
                                Boolean(activeInspectedPotentialId) &&
                                row.potentialId === activeInspectedPotentialId;
                              return (
                                <tr
                                  key={`${row.name}-${idx}`}
                                  className={cn(
                                    'transition-colors hover:bg-surface-hover/50',
                                    isInspected && 'ring-2 ring-inset ring-amber-400'
                                  )}
                                >
                                  <th
                                    scope="row"
                                    style={getSlotRoleTintStyle(row.slot)}
                                    className="px-3 py-1.5 text-left font-medium text-slate-900 dark:text-white"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {row.characterId && (
                                        <img
                                          src={getTrekkerImageUrl(row.characterId)}
                                          alt=""
                                          width={18}
                                          height={18}
                                          loading="lazy"
                                          decoding="async"
                                          className="size-[18px] rounded-full object-cover object-top shrink-0 border border-border-subtle"
                                        />
                                      )}
                                      {row.potentialId && onInspectPotential ? (
                                        <button
                                          type="button"
                                          data-pot-tile="true"
                                          aria-expanded={isInspected}
                                          onClick={(e) =>
                                            onInspectPotential(
                                              row.potentialId!,
                                              row.baseLevel ?? 6,
                                              e.currentTarget.getBoundingClientRect()
                                            )
                                          }
                                          className="truncate text-left hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                        >
                                          {row.name}
                                        </button>
                                      ) : (
                                        <span className="truncate">{row.name}</span>
                                      )}
                                    </div>
                                  </th>
                                  <td
                                    style={
                                      row.kind !== 'mechanic' && row.value !== null
                                        ? getHeatmapStyle(row.value, potRankMax, 'amber')
                                        : undefined
                                    }
                                    className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white"
                                  >
                                    {row.kind === 'mechanic' || row.value === null ? (
                                      <span className="inline-block rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-white/75">
                                        Mechanic
                                      </span>
                                    ) : (
                                      formatPct2(row.value)
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {potPlus3Rows.length > 0 && (
                    <div
                      className={cn(
                        'overflow-x-auto rounded-xl border border-border bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        potRankRows.length > 0 ? 'lg:col-span-7' : ''
                      )}
                      tabIndex={0}
                      role="region"
                      aria-label="Potential +3 scaling table"
                    >
                      <table className="w-full min-w-[360px] border-collapse text-xs sm:text-[13px]">
                        <thead>
                          <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
                            <th colSpan={3} className="px-3 py-2 text-center font-bold">
                              <span className="inline-flex items-center justify-center gap-2">
                                <span>Potential Lv +3</span>
                                {potPlus3IsEstimatedFallback && (
                                  <span className="px-1.5 py-0.5 rounded-full border border-amber-500/35 bg-amber-500/15 text-[11px] font-semibold text-amber-800">
                                    Estimated
                                  </span>
                                )}
                              </span>
                            </th>
                          </tr>
                          <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
                            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                              Name
                            </th>
                            <th scope="col" className="px-3 py-1.5 text-right font-semibold w-28">
                              Team Dmg
                            </th>
                            <th scope="col" className="px-3 py-1.5 text-right font-semibold w-28">
                              Personal Dmg
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {filteredPotPlus3Rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-3 py-5 text-center text-slate-600 dark:text-white/70"
                              >
                                No +3 scaling potentials for this Trekker.
                              </td>
                            </tr>
                          ) : (
                            filteredPotPlus3Rows.map((row, idx) => {
                              const isInspected =
                                Boolean(activeInspectedPotentialId) &&
                                row.potentialId === activeInspectedPotentialId;
                              return (
                                <tr
                                  key={`${row.name}-${idx}`}
                                  className={cn(
                                    'transition-colors hover:bg-surface-hover/50',
                                    row.separatorBefore && 'border-t-4 border-border',
                                    isInspected && 'ring-2 ring-inset ring-amber-400'
                                  )}
                                >
                                  <th
                                    scope="row"
                                    style={getSlotRoleTintStyle(row.slot)}
                                    className={cn(
                                      'px-3 py-1.5 text-left text-slate-900 dark:text-white',
                                      row.isRecommended ? 'font-bold' : 'font-medium'
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {row.characterId && (
                                        <img
                                          src={getTrekkerImageUrl(row.characterId)}
                                          alt=""
                                          width={18}
                                          height={18}
                                          loading="lazy"
                                          decoding="async"
                                          className="size-[18px] rounded-full object-cover object-top shrink-0 border border-border-subtle"
                                        />
                                      )}
                                      {row.potentialId && onInspectPotential ? (
                                        <button
                                          type="button"
                                          data-pot-tile="true"
                                          aria-expanded={isInspected}
                                          onClick={(e) =>
                                            onInspectPotential(
                                              row.potentialId!,
                                              row.upgradedLevel ?? Math.min(9, (row.baseLevel ?? 6) + 3),
                                              e.currentTarget.getBoundingClientRect()
                                            )
                                          }
                                          className="truncate text-left hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                        >
                                          {row.name}
                                        </button>
                                      ) : (
                                        <span className="truncate">{row.name}</span>
                                      )}
                                      {row.baseLevel !== undefined &&
                                        row.upgradedLevel !== undefined &&
                                        row.upgradedLevel > row.baseLevel && (
                                          <span className="shrink-0 text-[11px] tabular-nums text-slate-600 dark:text-white/70">
                                            Lv{row.baseLevel}→{row.upgradedLevel}
                                          </span>
                                        )}
                                    </div>
                                  </th>
                                  <td
                                    style={
                                      row.kind !== 'mechanic' && row.teamDmg !== null
                                        ? getHeatmapStyle(row.teamDmg, potPlus3TeamMax, 'emerald')
                                        : undefined
                                    }
                                    className={cn(
                                      'px-3 py-1.5 text-right tabular-nums text-slate-900 dark:text-white',
                                      row.isRecommended ? 'font-bold' : 'font-semibold'
                                    )}
                                  >
                                    {row.kind === 'mechanic' || row.teamDmg === null ? (
                                      <span className="inline-block rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-white/75">
                                        Mechanic
                                      </span>
                                    ) : (
                                      formatPct2(row.teamDmg)
                                    )}
                                  </td>
                                  <td
                                    className={cn(
                                      'px-3 py-1.5 text-right tabular-nums text-slate-800 dark:text-white/90',
                                      row.isRecommended && 'font-semibold'
                                    )}
                                  >
                                    {row.personalDmg !== null ? (
                                      formatPct2(row.personalDmg)
                                    ) : (
                                      <span className="text-slate-400 dark:text-white/35">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Emblems */}
        {showEmblems && activeEmblemColumns.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Emblem (Personal Damage)
              </h3>
              {hasSheetEmblems && hasEstimatedEmblems && (
                <SourceSwitcher
                  ariaLabel="Emblem priority source"
                  value={effectiveEmblemSource}
                  onChange={setEmblemSource}
                />
              )}
            </div>

            <div
              className={cn(
                'grid gap-4 items-start',
                activeEmblemColumns.length >= 3
                  ? 'grid-cols-1 md:grid-cols-3'
                  : activeEmblemColumns.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 max-w-md'
              )}
            >
              {activeEmblemColumns.map((col) => {
                const maxGain = col.rows.reduce(
                  (max, r) => (r.dmgGain > max ? r.dmgGain : max),
                  0
                );
                const dpsShare = 'dpsSharePct' in col ? col.dpsSharePct : null;
                return (
                  <div
                    key={`${col.trekkerId}-${col.label}`}
                    className="overflow-x-auto rounded-xl border border-border bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    tabIndex={0}
                    role="region"
                    aria-label={`${col.label} emblem stat priority`}
                  >
                    <table className="w-full min-w-[260px] border-collapse text-xs sm:text-[13px]">
                      <thead>
                        <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
                          <th colSpan={2} className="px-3 py-2 text-center font-bold">
                            <span className="inline-flex items-center justify-center gap-2">
                              <img
                                src={getTrekkerImageUrl(col.trekkerId)}
                                alt=""
                                width={20}
                                height={20}
                                loading="lazy"
                                decoding="async"
                                className="size-5 rounded-full object-cover object-top shrink-0 border border-border-subtle"
                              />
                              <span>{col.label}</span>
                              {dpsShare !== null && (
                                <span className="px-1.5 py-0.5 rounded border border-border bg-surface-card text-[11px] tabular-nums font-semibold text-slate-700 dark:text-white/85">
                                  {dpsShare}% team
                                </span>
                              )}
                            </span>
                          </th>
                        </tr>
                        <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
                          <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                            Stat
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold w-28">
                            Dmg Gain
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {col.rows.map((row, idx) => (
                          <tr key={`${row.stat}-${idx}`} className="hover:bg-surface-hover/50">
                            <th
                              scope="row"
                              className={cn(
                                'px-3 py-1.5 text-left text-slate-900 dark:text-white',
                                row.isRecommended ? 'font-bold' : 'font-medium'
                              )}
                            >
                              {row.stat}
                            </th>
                            <td
                              style={getHeatmapStyle(row.dmgGain, maxGain, col.palette)}
                              className={cn(
                                'px-3 py-1.5 text-right tabular-nums text-slate-900 dark:text-white',
                                row.isRecommended ? 'font-bold' : 'font-semibold'
                              )}
                            >
                              {formatPct2(row.dmgGain)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Talents */}
        {showTalents && activeTalents.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Talent Scaling (T0–T5)
              </h3>
              {hasSheetTalents && hasEstimatedTalents && (
                <SourceSwitcher
                  ariaLabel="Talent scaling source"
                  value={effectiveTalentSource}
                  onChange={setTalentSource}
                />
              )}
            </div>

            <div className="space-y-4">
              {activeTalents.map((table) => {
                const maxPersonalInc = table.tiers.reduce(
                  (m, r) => (r.personalInc > m ? r.personalInc : m),
                  0
                );
                const maxPersonalRel = table.tiers.reduce(
                  (m, r) => (r.personalRelativeInc > m ? r.personalRelativeInc : m),
                  0
                );
                const maxTeamInc = table.tiers.reduce(
                  (m, r) => (r.teamInc > m ? r.teamInc : m),
                  0
                );
                const maxTeamRel = table.tiers.reduce(
                  (m, r) => (r.teamRelativeInc > m ? r.teamRelativeInc : m),
                  0
                );

                return (
                  <div
                    key={table.trekkerId}
                    className="overflow-x-auto rounded-xl border border-border bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    tabIndex={0}
                    role="region"
                    aria-label={`Talent scaling table for ${table.label}`}
                  >
                    <table className="w-full min-w-[680px] border-collapse text-xs sm:text-[13px]">
                      <thead>
                        <tr className="bg-slate-200/80 text-slate-900 dark:text-white border-b border-border">
                          <th colSpan={7} className="px-3 py-2 text-center font-bold">
                            Talent - {table.label}
                          </th>
                        </tr>
                        <tr className="bg-surface-subtle text-slate-700 dark:text-white/85 border-b border-border">
                          <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                            Name
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                            {table.label} Dmg
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                            Dmg Inc
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold border-r border-border">
                            {table.personalRelativeLabel || 'Relative Inc'}
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                            Team Dmg
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                            Dmg Inc
                          </th>
                          <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                            Relative Inc
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {table.tiers.map((row) => (
                          <tr key={row.tier} className="hover:bg-surface-hover/50">
                            <th
                              scope="row"
                              className="px-3 py-1.5 text-left font-semibold text-slate-900 dark:text-white whitespace-nowrap"
                            >
                              {table.label} T{row.tier}
                            </th>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-900 dark:text-white">
                              {formatDamageInt(row.personalDmg)}
                            </td>
                            <td
                              style={getHeatmapStyle(row.personalInc, maxPersonalInc, 'amber')}
                              className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white"
                            >
                              {formatPct1(row.personalInc)}
                            </td>
                            <td
                              style={getHeatmapStyle(
                                row.personalRelativeInc,
                                maxPersonalRel,
                                'emerald'
                              )}
                              className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white border-r border-border"
                            >
                              {formatPct1(row.personalRelativeInc)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-900 dark:text-white">
                              {formatDamageInt(row.teamDmg)}
                            </td>
                            <td
                              style={getHeatmapStyle(row.teamInc, maxTeamInc, 'amber')}
                              className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white"
                            >
                              {formatPct1(row.teamInc)}
                            </td>
                            <td
                              style={getHeatmapStyle(row.teamRelativeInc, maxTeamRel, 'emerald')}
                              className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white"
                            >
                              {formatPct1(row.teamRelativeInc)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assumptions Footnote */}
        {analytics?.assumptions && anySheetVisible && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle/90 px-3.5 py-2.5 text-xs text-slate-700 dark:text-white/85">
            <Info className="size-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="font-semibold text-slate-900 dark:text-white">
                Assumption:{' '}
              </strong>
              {analytics.assumptions}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
