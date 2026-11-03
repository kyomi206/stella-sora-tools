import { calculateResAmend } from './damage-engine.ts';
import type { DiscAndNoteContributions } from './damage-engine.ts';
import { calculateTeam } from './fighter-calc.ts';
import type { SlotKey, TeamCalcInput } from './fighter-calc.ts';

export interface TalentSweepPoint {
  tier: number;
  teamDmg: number;
  personalDmg: number;
  teamGainPct: number;
  personalGainPct: number;
}

/**
 * Sweep one fighter's talent tier while every other fighter keeps its own
 * tier. Results are relative to the first requested tier.
 */
export function computeTalentProgression(
  input: TeamCalcInput,
  slot: SlotKey,
  tiers: number[] = [0, 1, 2, 3, 4, 5]
): TalentSweepPoint[] {
  const points = tiers.map((tier) => {
    const cloned = structuredClone(input);
    const fighter = cloned.fighters.find((item) => item.state.slot === slot);
    if (fighter) fighter.state.talentTier = tier;

    const result = calculateTeam(cloned);
    const personal = result.fighters.find((item) => item.state.slot === slot);

    return {
      tier,
      teamDmg: result.totalExpected,
      personalDmg: personal?.totals.expected ?? 0,
    };
  });

  const first = points[0] ?? { teamDmg: 0, personalDmg: 0 };

  return points.map((point) => ({
    ...point,
    teamGainPct:
      first.teamDmg > 0 ? ((point.teamDmg - first.teamDmg) / first.teamDmg) * 100 : 0,
    personalGainPct:
      first.personalDmg > 0
        ? ((point.personalDmg - first.personalDmg) / first.personalDmg) * 100
        : 0,
  }));
}

export interface DiscSweepEntry {
  slot: 'main' | 'support';
  index: number;
  discId: number;
  name: string;
}

export interface DiscSweepPoint extends DiscSweepEntry {
  teamDmg: number;
  lossPct: number;
}

/**
 * Recompute team damage with each equipped disc removed. The caller owns the
 * contribution rebuild so this module stays free of preset/notes plumbing.
 */
export function computeDiscContributions(
  input: TeamCalcInput,
  entries: DiscSweepEntry[],
  rebuildContributions: (without: DiscSweepEntry | null) => DiscAndNoteContributions
): DiscSweepPoint[] {
  if (entries.length === 0) return [];

  const baseline = calculateTeam(input).totalExpected;

  return entries.map((entry) => {
    const teamDmg = calculateTeam({
      ...input,
      contributions: rebuildContributions(entry),
    }).totalExpected;

    return {
      ...entry,
      teamDmg,
      lossPct: baseline > 0 ? ((baseline - teamDmg) / baseline) * 100 : 0,
    };
  });
}

export interface PenPoint {
  pen: number;
  effectiveRes: number;
  erAmend: number;
  gainPct: number;
}

/** Flat RES PEN curve against one target, relative to 0 PEN. */
export function computePenCurve(
  enemyRes: number,
  vulPct = 0,
  resIgnorePct = 0,
  maxPen = 250,
  step = 10
): PenPoint[] {
  const points: Array<Omit<PenPoint, 'gainPct'>> = [];
  for (let pen = 0; pen <= maxPen; pen += step) {
    const { effectiveRes, erAmend } = calculateResAmend(enemyRes, pen, vulPct, resIgnorePct);
    points.push({ pen, effectiveRes, erAmend });
  }

  const baseline = points[0]?.erAmend ?? 0;

  return points.map((point) => ({
    ...point,
    gainPct: baseline > 0 ? ((point.erAmend - baseline) / baseline) * 100 : 0,
  }));
}
