import type { CSSProperties } from 'react';

export type DiscDupeLabel = 'C1' | 'C6' | 'Base';

export interface DiscRankRow {
  name: string;
  discId?: number;
  dupe: DiscDupeLabel;
  value: number;
  isBaseline?: boolean;
}

export interface DiscRankingsData {
  metricLabel: string;
  main: DiscRankRow[];
  support: DiscRankRow[];
}

export type SkillHighlightTone = 'rose' | 'violet' | 'cyan';

export interface SkillPlus3Cell {
  value: number | null;
  highlight?: SkillHighlightTone;
}

export interface SkillPlus3Row {
  skill: 'AA' | 'Main Skill' | 'Support Skill' | 'Ultimate';
  cells: SkillPlus3Cell[];
}

export interface SkillPlus3Variant {
  label: string;
  trekkerColumns: Array<{
    trekkerId: number;
    label: string;
  }>;
  rows: SkillPlus3Row[];
}

export interface PotRankRow {
  name: string;
  value: number;
}

export interface PotPlus3Row {
  name: string;
  teamDmg: number | null;
  personalDmg: number | null;
  isRecommended?: boolean;
  separatorBefore?: boolean;
}

export type HeatmapPalette = 'emerald' | 'amber' | 'sky';

export interface EmblemStatRow {
  stat: string;
  dmgGain: number;
  isRecommended?: boolean;
}

export interface EmblemColumn {
  trekkerId: number;
  label: string;
  palette: HeatmapPalette;
  rows: EmblemStatRow[];
}

export interface TalentTierRow {
  tier: number;
  personalDmg: number;
  personalInc: number;
  personalRelativeInc: number;
  teamDmg: number;
  teamInc: number;
  teamRelativeInc: number;
}

export interface TalentTrekkerTable {
  trekkerId: number;
  label: string;
  personalRelativeLabel?: string;
  tiers: TalentTierRow[];
}

export interface CommunityBuildAnalytics {
  discRankings?: DiscRankingsData;
  skillPlus3?: SkillPlus3Variant[];
  potRank?: PotRankRow[];
  potPlus3?: PotPlus3Row[];
  emblems?: EmblemColumn[];
  talents?: TalentTrekkerTable[];
  assumptions?: string;
}

const HEATMAP_RGB: Record<HeatmapPalette, string> = {
  emerald: '16, 185, 129',
  amber: '245, 158, 11',
  sky: '14, 165, 233',
};

/**
 * Normalizes a numeric cell value against a column max into a WCAG AA-safe translucent
 * background tint (alpha clamped strictly to 0.08..0.40) so `text-slate-900 dark:text-white`
 * stays above 4.5:1 contrast in both Daylight and Dark Navy themes.
 */
export function getHeatmapStyle(
  value: number | null | undefined,
  maxValue: number,
  palette: HeatmapPalette = 'emerald'
): CSSProperties | undefined {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(maxValue) ||
    maxValue <= 0
  ) {
    return undefined;
  }

  const ratio = Math.max(0, Math.min(1, value / maxValue));
  const alpha = Number((0.08 + ratio * 0.32).toFixed(3));
  return {
    backgroundColor: `rgba(${HEATMAP_RGB[palette]}, ${alpha})`,
  };
}

export type SquadSlotTone = 'vanguard' | 'versatile' | 'support';

const SLOT_ROLE_TINT: Record<SquadSlotTone, string> = {
  vanguard: 'rgba(245, 158, 11, 0.14)',
  versatile: 'rgba(14, 165, 233, 0.14)',
  support: 'rgba(244, 63, 94, 0.14)',
};

export function getSlotRoleTintStyle(
  slot?: SquadSlotTone | null
): CSSProperties | undefined {
  if (!slot || !(slot in SLOT_ROLE_TINT)) return undefined;
  return { backgroundColor: SLOT_ROLE_TINT[slot] };
}

export function getSlotRoleDotClass(slot?: SquadSlotTone | null): string {
  if (slot === 'vanguard') return 'bg-amber-500';
  if (slot === 'versatile') return 'bg-sky-500';
  if (slot === 'support') return 'bg-rose-500';
  return 'bg-slate-400';
}
