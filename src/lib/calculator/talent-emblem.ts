import raw from '../../data/talent-emblem.json' with { type: 'json' };
import type { BuffStatKey } from './damage-engine.ts';
import type { ElementType } from '../../types/index.ts';

export type EmblemRarity = 'Green' | 'Blue' | 'Yellow' | 'Rainbow';
export type EmblemLevel = '70' | '80' | '90';

export const EMBLEM_LEVELS: EmblemLevel[] = ['70', '80', '90'];
export const EMBLEM_RARITIES: EmblemRarity[] = ['Green', 'Blue', 'Yellow', 'Rainbow'];
export const EMBLEM_ROW_COUNT = 4;

export interface EmblemRowState {
  stat: string;
  rarity: EmblemRarity;
}

export interface EmblemStatMeta {
  stat: string;
  label: string;
  key: BuffStatKey;
  percent: boolean;
}

/**
 * Spreadsheet emblem stats mapped onto calculator stat keys. Charge-efficiency
 * rows are omitted because they do not change damage.
 */
const EMBLEM_STAT_META: Record<string, Omit<EmblemStatMeta, 'stat'>> = {
  'RES PEN': { label: 'RES PEN', key: 'resPen', percent: false },
  'ATK% (Perma)': { label: 'ATK% (Perma)', key: 'atkPctPerma', percent: true },
  'Base ATK': { label: 'Base ATK', key: 'baseAtk', percent: false },
  'HP%': { label: 'HP%', key: 'hpPct', percent: true },
  'DEF%': { label: 'DEF%', key: 'defPct', percent: true },
  'Base HP': { label: 'Base HP', key: 'baseHp', percent: false },
  'Base DEF': { label: 'Base DEF', key: 'baseDef', percent: false },
  AA: { label: 'AA DMG%', key: 'aaDmg', percent: true },
  Skill: { label: 'Skill DMG%', key: 'skillDmg', percent: true },
  Ult: { label: 'Ultimate DMG%', key: 'ultDmg', percent: true },
  Mark: { label: 'Mark DMG%', key: 'markDmg', percent: true },
  Minion: { label: 'Minion DMG%', key: 'minionDmg', percent: true },
  Element: { label: 'Element DMG%', key: 'elementDmg', percent: true },
  'Crit dmg%': { label: 'Crit DMG%', key: 'critDmg', percent: true },
  'Crit rate%': { label: 'Crit Rate%', key: 'critRate', percent: true },
  'AA Crit rate%': { label: 'AA Crit Rate%', key: 'aaCritRate', percent: true },
  'Skill Crit rate%': { label: 'Skill Crit Rate%', key: 'skillCritRate', percent: true },
  'Ult Crit rate%': { label: 'Ult Crit Rate%', key: 'ultCritRate', percent: true },
  'Mark Crit rate%': { label: 'Mark Crit Rate%', key: 'markCritRate', percent: true },
  'Minion Crit rate%': { label: 'Minion Crit Rate%', key: 'minionCritRate', percent: true },
};

const EMBLEM_TABLES = raw.emblems as Record<
  EmblemLevel,
  Record<string, Partial<Record<EmblemRarity, number>>>
>;

export function getEmblemValues(
  level: EmblemLevel,
  stat: string
): Partial<Record<EmblemRarity, number>> | undefined {
  return EMBLEM_TABLES[level]?.[stat];
}

export function getEmblemStatOptions(level: EmblemLevel): EmblemStatMeta[] {
  const table = EMBLEM_TABLES[level] ?? {};
  return Object.keys(table)
    .filter((stat) => stat in EMBLEM_STAT_META)
    .map((stat) => ({ stat, ...EMBLEM_STAT_META[stat] }));
}

export function getEmblemRarities(
  level: EmblemLevel,
  stat: string
): EmblemRarity[] {
  const values = getEmblemValues(level, stat);
  if (!values) return EMBLEM_RARITIES;
  return EMBLEM_RARITIES.filter((rarity) => values[rarity] !== undefined);
}

export function getEmblemValue(
  level: EmblemLevel,
  stat: string,
  rarity: EmblemRarity
): number {
  const value = getEmblemValues(level, stat)?.[rarity];
  return typeof value === 'number' ? value : 0;
}

export function getEmblemStatMeta(stat: string): Omit<EmblemStatMeta, 'stat'> | undefined {
  return EMBLEM_STAT_META[stat];
}

/* ------------------------------------------------------------------ */
/* Talents                                                             */
/* ------------------------------------------------------------------ */

export interface TalentRow {
  stat: string;
  value: number;
  target: string;
}

const TALENT_TABLE = raw.talents as Record<string, TalentRow[][]>;
const TALENT_KEY_OVERRIDES = raw.talentNames as Record<string, string>;

export function getTalentKey(characterId: string, displayName: string): string {
  return TALENT_KEY_OVERRIDES[characterId] ?? displayName;
}

export function getTalentTiers(characterId: string, displayName: string): TalentRow[][] {
  return TALENT_TABLE[getTalentKey(characterId, displayName)] ?? [];
}

const ELEMENT_NAMES: ElementType[] = ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Lux', 'Umbra'];

const TYPE_STAT_KEYS: Record<string, BuffStatKey> = {
  AA: 'aaDmg',
  Skill: 'skillDmg',
  Ult: 'ultDmg',
  Mark: 'markDmg',
  Minion: 'minionDmg',
};

const TYPE_TAKEN_KEYS: Record<string, BuffStatKey> = {
  'AA taken': 'aaTaken',
  'Skill taken': 'skillTaken',
  'Ult taken': 'ultTaken',
  'Mark taken': 'markTaken',
  'Minion taken': 'minionTaken',
};

const TYPE_CRIT_RATE_KEYS: Record<string, BuffStatKey> = {
  'AA Crit rate%': 'aaCritRate',
  'Skill Crit rate%': 'skillCritRate',
  'Ult Crit rate%': 'ultCritRate',
  'Mark Crit rate%': 'markCritRate',
  'Minion Crit rate%': 'minionCritRate',
};

const TYPE_CRIT_DMG_KEYS: Record<string, BuffStatKey> = {
  'AA Crit dmg%': 'aaCritDmg',
  'Skill Crit dmg%': 'skillCritDmg',
  'Ult Crit dmg%': 'ultCritDmg',
  'Mark Crit dmg%': 'markCritDmg',
  'Minion Crit dmg%': 'minionCritDmg',
};

export interface TalentBonus {
  key: BuffStatKey;
  value: number;
  /** Resolved at render time: all, main/vanguard, one element, one slot, or self. */
  target: string;
  /** Element the bonus applies to, when the row is element-scoped. */
  element?: ElementType;
}

/** Turn a spreadsheet talent row into a calculator stat bonus. */
export function mapTalentRow(row: TalentRow): TalentBonus | null {
  const { stat, target } = row;
  // Values are stored as fractions; percent stats become calculator percentages.
  const pct = row.value * 100;

  const targetElement = ELEMENT_NAMES.find((element) => element === target);
  const statElement =
    ELEMENT_NAMES.find((element) => element === stat) ??
    ELEMENT_NAMES.find((element) => stat === `${element} taken`);
  const element = targetElement ?? statElement;

  if (stat === 'ATK%') return { key: 'atkPct', value: pct, target };
  if (stat === 'ATK% (Perma)') return { key: 'atkPctPerma', value: pct, target };
  if (stat === 'Crit rate%') return { key: 'critRate', value: pct, target };
  if (stat === 'Crit dmg%') return { key: 'critDmg', value: pct, target };

  const critRateType = TYPE_CRIT_RATE_KEYS[stat];
  if (critRateType) {
    return { key: critRateType, value: pct, target, element };
  }
  const critDmgType = TYPE_CRIT_DMG_KEYS[stat];
  if (critDmgType) {
    return { key: critDmgType, value: pct, target, element };
  }
  if (stat === 'DMG Multiplier') return { key: 'customMultiplier', value: pct, target };
  if (stat === 'HP') return { key: 'hpPct', value: pct, target };
  if (stat === 'DEF') return { key: 'defPct', value: pct, target };

  if (stat in TYPE_STAT_KEYS) {
    return { key: TYPE_STAT_KEYS[stat], value: pct, target, element };
  }
  if (stat in TYPE_TAKEN_KEYS) {
    return { key: TYPE_TAKEN_KEYS[stat], value: pct, target, element };
  }

  if (statElement) {
    return statElement === stat
      ? { key: 'elementDmg', value: pct, target, element }
      : { key: 'elementTaken', value: pct, target, element };
  }

  return null;
}

export type TalentTarget =
  | { kind: 'all' }
  | { kind: 'main' }
  | { kind: 'element'; element: ElementType }
  | { kind: 'slot'; slot: 'vanguard' | 'versatile' | 'support' }
  | { kind: 'other' };

const SLOT_TARGETS: Record<string, 'vanguard' | 'versatile' | 'support'> = {
  Trekker1: 'vanguard',
  Trekker2: 'versatile',
  Trekker3: 'support',
};

/** Resolve a spreadsheet target string to a scope. */
export function resolveTalentTarget(
  target: string,
  context: { slot: 'vanguard' | 'versatile' | 'support'; element: ElementType; talentKey: string }
): TalentTarget {
  if (target === 'Squad' || target === 'Team') return { kind: 'all' };
  if (target === 'Main') return { kind: 'main' };
  if (target in SLOT_TARGETS) return { kind: 'slot', slot: SLOT_TARGETS[target] };
  const element = ELEMENT_NAMES.find((name) => name === target);
  if (element) return { kind: 'element', element };
  if (target === context.talentKey) return { kind: 'slot', slot: context.slot };
  return { kind: 'other' };
}
