import raw from '../../data/talent-emblem.json' with { type: 'json' };
import trekkerTalentsRaw from '../../data/trekker-talents.json' with { type: 'json' };
import type { BuffStatKey, DamageType } from './damage-engine.ts';
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

export type SkillLevelSource = 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate';

export interface EmblemStatMeta {
  stat: string;
  label: string;
  key?: BuffStatKey;
  skillSource?: SkillLevelSource;
  percent: boolean;
  levelBonus?: boolean;
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
  'AA Lv+': { label: 'Auto Attack Lv+', skillSource: 'normalAtk', percent: false, levelBonus: true },
  'Skill Lv+': { label: 'Main Skill Lv+', skillSource: 'skill', percent: false, levelBonus: true },
  'Support Lv+': { label: 'Support Skill Lv+', skillSource: 'supportSkill', percent: false, levelBonus: true },
  'Ult Lv+': { label: 'Ultimate Lv+', skillSource: 'ultimate', percent: false, levelBonus: true },
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

export function getEmblemSkillLevelBonuses(
  emblems: Record<EmblemLevel, EmblemRowState[]>
): Record<SkillLevelSource, number> {
  const bonuses: Record<SkillLevelSource, number> = {
    normalAtk: 0,
    skill: 0,
    supportSkill: 0,
    ultimate: 0,
  };
  for (const level of EMBLEM_LEVELS) {
    for (const row of emblems[level] ?? []) {
      if (!row.stat) continue;
      const meta = EMBLEM_STAT_META[row.stat];
      if (!meta?.skillSource) continue;
      bonuses[meta.skillSource] += getEmblemValue(level, row.stat, row.rarity);
    }
  }
  return bonuses;
}

/* ------------------------------------------------------------------ */
/* Talents                                                             */
/* ------------------------------------------------------------------ */

export interface TalentRow {
  stat: string;
  value: number;
  target: string;
  damageTypes?: DamageType[];
  requiresSquadMarkElement?: ElementType;
  requiresElementCount?: { element: ElementType; min: number };
  realisticUptime?: number;
}

const TALENT_TABLE = raw.talents as Record<string, TalentRow[][]>;
const TALENT_KEY_OVERRIDES = raw.talentNames as Record<string, string>;

export const TALENT_NAME_ALIASES: Record<string, string> = {
  'Snowish Laru': 'S.Laru',
  'Springseek Coronis': 'S.Coronis',
  'Suntide Willow': 'S.Willow',
  'Firstlight Noya': 'F.Noya',
};

export function getTalentKey(characterId: string, displayName: string): string {
  return TALENT_KEY_OVERRIDES[characterId] ?? TALENT_NAME_ALIASES[displayName] ?? displayName;
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

const TYPE_SKILL_INTENSITY_KEYS: Record<DamageType, BuffStatKey> = {
  'Auto Attack': 'aaSkillIntensity',
  Skill: 'skillSkillIntensity',
  Ultimate: 'ultSkillIntensity',
  Mark: 'markSkillIntensity',
  Minion: 'minionSkillIntensity',
};

export interface TalentBonus {
  key: BuffStatKey;
  keys?: BuffStatKey[];
  value: number;
  /** Resolved at render time: all, main/vanguard, one element, one slot, or self. */
  target: string;
  /** Element the bonus applies to, when the row is element-scoped. */
  element?: ElementType;
  requiresSquadMarkElement?: ElementType;
  requiresElementCount?: { element: ElementType; min: number };
  realisticUptime?: number;
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

  const withMeta = (bonus: TalentBonus): TalentBonus => ({
    ...bonus,
    ...(row.requiresSquadMarkElement
      ? { requiresSquadMarkElement: row.requiresSquadMarkElement }
      : {}),
    ...(row.requiresElementCount
      ? { requiresElementCount: row.requiresElementCount }
      : {}),
    ...(row.realisticUptime !== undefined ? { realisticUptime: row.realisticUptime } : {}),
  });

  if (stat === 'ATK%') return withMeta({ key: 'atkPct', value: pct, target });
  if (stat === 'ATK% (Perma)') return withMeta({ key: 'atkPctPerma', value: pct, target });
  if (stat === 'Crit rate%') return withMeta({ key: 'critRate', value: pct, target });
  if (stat === 'Crit dmg%') return withMeta({ key: 'critDmg', value: pct, target });

  const critRateType = TYPE_CRIT_RATE_KEYS[stat];
  if (critRateType) {
    return withMeta({ key: critRateType, value: pct, target, element });
  }
  const critDmgType = TYPE_CRIT_DMG_KEYS[stat];
  if (critDmgType) {
    return withMeta({ key: critDmgType, value: pct, target, element });
  }
  if (stat === 'DMG Multiplier') {
    if (row.damageTypes && row.damageTypes.length > 0) {
      const keys = row.damageTypes.map((dt) => TYPE_SKILL_INTENSITY_KEYS[dt]);
      return withMeta({ key: keys[0], keys, value: pct, target });
    }
    return withMeta({ key: 'skillIntensity', value: pct, target });
  }
  if (stat === 'HP') return withMeta({ key: 'hpPct', value: pct, target });
  if (stat === 'DEF') return withMeta({ key: 'defPct', value: pct, target });

  if (stat in TYPE_STAT_KEYS) {
    return withMeta({ key: TYPE_STAT_KEYS[stat], value: pct, target, element });
  }
  if (stat in TYPE_TAKEN_KEYS) {
    return withMeta({ key: TYPE_TAKEN_KEYS[stat], value: pct, target, element });
  }

  if (statElement) {
    return withMeta(
      statElement === stat
        ? { key: 'elementDmg', value: pct, target, element }
        : { key: 'elementTaken', value: pct, target, element }
    );
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

const TALENT_MINOR_STAT_MAP: Record<string, BuffStatKey> = {
  'Base ATK': 'baseAtk',
  'Base HP': 'baseHp',
  'Base DEF': 'baseDef',
  ATK: 'atkPctPerma',
  'Crit DMG': 'critDmg',
  'Auto Attack DMG': 'aaDmg',
  'Auto Attack DMG Boost': 'aaDmg',
  'Skill DMG': 'skillDmg',
  'Skill DMG Boost': 'skillDmg',
  'Ultimate DMG': 'ultDmg',
  'Ignis DMG': 'elementDmg',
  'Aqua DMG': 'elementDmg',
  'Terra DMG': 'elementDmg',
  'Ventus DMG': 'elementDmg',
  'Lux DMG': 'elementDmg',
  'Umbra DMG': 'elementDmg',
};

interface TrekkerTalentEntry {
  tier: number;
  statBonuses?: Array<{ stat: string; value: string }>;
}

const TREKKER_TALENTS = trekkerTalentsRaw as Record<string, TrekkerTalentEntry[]>;

export function getTalentMinorStatBonuses(
  characterId: string,
  talentTier: number
): Array<{ key: BuffStatKey; value: number }> {
  const tiers = TREKKER_TALENTS[characterId];
  if (!tiers || talentTier <= 0) return [];
  const result: Array<{ key: BuffStatKey; value: number }> = [];
  const limit = Math.min(talentTier, tiers.length);
  for (let i = 0; i < limit; i++) {
    for (const bonus of tiers[i]?.statBonuses ?? []) {
      const key = TALENT_MINOR_STAT_MAP[bonus.stat];
      const value = parseFloat(String(bonus.value));
      if (key && Number.isFinite(value) && value !== 0) {
        result.push({ key, value });
      }
    }
  }
  return result;
}
