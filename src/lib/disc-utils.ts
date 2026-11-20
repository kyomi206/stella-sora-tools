import type { SSDisc } from '../types/index.ts';

export interface DiscStatSummary {
  baseAtk: number;
  bonusAtk: number;
  totalAtk: number;
  secondaryLabel: string;
  secondaryValue: string;
}

/** Converts a Runic Disc name into a stable lowercase URL slug. */
export function getDiscSlug(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getDiscSupportNotesAtPhase(
  disc: SSDisc,
  phase: number
): Record<string, number> {
  if (!disc.supportNote || disc.supportNote.length === 0) return {};
  const clamped = Math.max(1, Math.min(disc.supportNote.length, Math.trunc(phase || 1)));
  return disc.supportNote[clamped - 1] || {};
}

export function getDiscStatSummary(
  disc: SSDisc,
  level: 'lv1' | 'lv80' | 'lv90',
  crescendo: number
): DiscStatSummary {
  const levelStats = disc.stats?.[level] || disc.stats?.lv90 || disc.stats?.lv80 || {};
  const clampedCrescendo = Math.max(1, Math.min(6, Math.trunc(crescendo || 1)));
  const baseAtk = Number(levelStats.ATK ?? 0);
  const bonusAtk =
    clampedCrescendo > 1 ? Number(disc.dupeAtk?.[clampedCrescendo - 2] ?? 0) : 0;

  const entries = Object.entries(levelStats);
  const secondaryEntry =
    entries.find(([key]) => key !== 'ATK' && key !== 'HP') ??
    entries.find(([key]) => key === 'HP');

  const rawSecVal = secondaryEntry?.[1];
  const secondaryValue =
    rawSecVal === undefined || rawSecVal === null
      ? '—'
      : typeof rawSecVal === 'number'
      ? rawSecVal.toLocaleString('en-US')
      : String(rawSecVal);

  return {
    baseAtk,
    bonusAtk,
    totalAtk: baseAtk + bonusAtk,
    secondaryLabel: secondaryEntry?.[0] || 'Bonus',
    secondaryValue,
  };
}
