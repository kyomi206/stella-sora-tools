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

function formatDiscStatValue(val: unknown): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'number') return val.toLocaleString('en-US');
  return String(val);
}

export function getDiscStatSummary(
  disc: SSDisc,
  level: 'lv1' | 'lv80' | 'lv90' | number,
  crescendo: number
): DiscStatSummary {
  const clampedCrescendo = Math.max(1, Math.min(6, Math.trunc(crescendo || 1)));
  const bonusAtk =
    clampedCrescendo > 1 ? Number(disc.dupeAtk?.[clampedCrescendo - 2] ?? 0) : 0;

  if (typeof level !== 'number' || level === 1 || level === 80 || level === 90) {
    const levelKey: 'lv1' | 'lv80' | 'lv90' =
      typeof level === 'number'
        ? level === 1
          ? 'lv1'
          : level === 80
            ? 'lv80'
            : 'lv90'
        : level;
    const levelStats = disc.stats?.[levelKey] || disc.stats?.lv90 || disc.stats?.lv80 || {};
    const baseAtk = Number(levelStats.ATK ?? 0);
    const entries = Object.entries(levelStats);
    const secondaryEntry =
      entries.find(([key]) => key !== 'ATK' && key !== 'HP') ??
      entries.find(([key]) => key === 'HP');

    return {
      baseAtk,
      bonusAtk,
      totalAtk: baseAtk + bonusAtk,
      secondaryLabel: secondaryEntry?.[0] || 'Bonus',
      secondaryValue: formatDiscStatValue(secondaryEntry?.[1]),
    };
  }

  const lvl = Math.max(1, Math.min(90, Math.round(level)));
  const lowerLevel = lvl > 80 ? 80 : 1;
  const upperLevel = lvl > 80 ? 90 : 80;
  const ratio = (lvl - lowerLevel) / (upperLevel - lowerLevel);

  const sLow =
    (lvl > 80 ? disc.stats?.lv80 : disc.stats?.lv1) || disc.stats?.lv90 || {};
  const sHigh =
    (lvl > 80 ? disc.stats?.lv90 : disc.stats?.lv80) || disc.stats?.lv90 || {};

  const atkLow = Number(sLow.ATK ?? 0);
  const atkHigh = Number(sHigh.ATK ?? atkLow);
  const baseAtk = Math.round(atkLow + ratio * (atkHigh - atkLow));

  const highEntries = Object.entries(sHigh);
  const secondaryEntry =
    highEntries.find(([key]) => key !== 'ATK' && key !== 'HP') ??
    highEntries.find(([key]) => key === 'HP');
  const secondaryLabel = secondaryEntry?.[0] || 'Bonus';

  let secondaryValue = '—';
  if (secondaryEntry) {
    const rawLow = sLow[secondaryLabel];
    const rawHigh = secondaryEntry[1];
    if (typeof rawHigh === 'number') {
      const lowNum = typeof rawLow === 'number' ? rawLow : rawHigh;
      secondaryValue = Math.round(lowNum + ratio * (rawHigh - lowNum)).toLocaleString('en-US');
    } else if (typeof rawHigh === 'string' && rawHigh.trim().endsWith('%')) {
      const highNum = parseFloat(rawHigh);
      const lowNum = rawLow !== undefined ? parseFloat(String(rawLow)) : highNum;
      if (Number.isFinite(highNum) && Number.isFinite(lowNum)) {
        const interp = lowNum + ratio * (highNum - lowNum);
        secondaryValue = `${Number(interp.toFixed(1))}%`;
      } else {
        secondaryValue = String(rawHigh);
      }
    } else {
      secondaryValue = formatDiscStatValue(rawHigh);
    }
  }

  return {
    baseAtk,
    bonusAtk,
    totalAtk: baseAtk + bonusAtk,
    secondaryLabel,
    secondaryValue,
  };
}
