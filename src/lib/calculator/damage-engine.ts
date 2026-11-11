import type { ElementType, NoteName, SSDisc, SelectedMainDisc, SelectedSupportDisc } from '../../types/index.ts';
import { MUSICAL_NOTES } from '../../data/notes.ts';

export type DamageType = 'Auto Attack' | 'Skill' | 'Ultimate' | 'Mark' | 'Minion';

export const DAMAGE_TYPES: DamageType[] = [
  'Auto Attack',
  'Skill',
  'Ultimate',
  'Mark',
  'Minion',
];

export const ELEMENTS: ElementType[] = ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Lux', 'Umbra'];

export const RECORD_LEVEL_BASE_ATK: Record<number, number> = {
  0: 0,
  1: 50,
  2: 65,
  3: 80,
  4: 95,
  5: 110,
  6: 125,
  7: 140,
  8: 155,
  9: 170,
  10: 185,
  11: 237,
  12: 297,
  13: 357,
  14: 462,
  15: 731,
  16: 791,
  17: 836,
  18: 851,
  19: 866,
  20: 1054,
  21: 1457,
  22: 1472,
  23: 1487,
  24: 1502,
  25: 2466,
  26: 2481,
  27: 2496,
  28: 2511,
  29: 2526,
  30: 2541,
  31: 3136,
  32: 3151,
  33: 3166,
  34: 3181,
  35: 3196,
  36: 3211,
  37: 3226,
  38: 3241,
  39: 3256,
  40: 3275,
};

const AFFINITY_ATK_PCT_MILESTONES = [5, 10, 15, 20, 25, 30];

export function getAffinityBonuses(affinityLevel: number): { baseAtk: number; atkPct: number } {
  const clamped = Math.max(0, Math.min(50, Math.floor(affinityLevel)));
  let milestonesPassed = 0;
  for (const m of AFFINITY_ATK_PCT_MILESTONES) {
    if (clamped >= m) milestonesPassed++;
  }
  const flatLevels = clamped - milestonesPassed;
  return {
    baseAtk: flatLevels * 36,
    atkPct: milestonesPassed * 4,
  };
}

/**
 * Effective DEF and defAmend from the Stella Sora damage formula:
 * Effective_DEF = DEF * (1 - DEF_Ignore) - DEF_Pen - DEF_Reduction
 * defAmend = 1 - (Effective_DEF * 40) / (Effective_DEF * 32 + 24000)
 */
export function calculateDefAmend(
  enemyDef: number,
  defReduction = 0,
  defPen = 0,
  ignoreDefPct = 0,
  defPenPct = 0
): { effectiveDef: number; defAmend: number } {
  const ignore = Math.max(0, Math.min(100, ignoreDefPct)) / 100;
  const effectiveDef =
    enemyDef * (1 - ignore) - defReduction - defPen * (1 + Math.max(0, defPenPct) / 100);
  const defAmend = 1 - (effectiveDef * 40) / (effectiveDef * 32 + 24000);
  return { effectiveDef, defAmend };
}

/**
 * Effective RES and erAmend from the Stella Sora damage formula.
 * Above 0 RES the result is the quadratic piecewise curve; at or below 0
 * the VUL / Suppress formula takes over.
 */
export function calculateResAmend(
  enemyRes: number,
  resPen = 0,
  vulExploitPct = 0,
  ignoreResPct = 0
): { effectiveRes: number; erAmend: number } {
  const cappedPen = Math.max(0, Math.min(250, resPen));
  const ignore = Math.max(0, Math.min(100, ignoreResPct)) / 100;
  const effectiveRes = enemyRes * (1 - ignore) - cappedPen;

  if (effectiveRes <= 0) {
    const vul = vulExploitPct / 100;
    const erAmend = 1 + vul * 0.1 + vul * effectiveRes * -0.01 * 0.9;
    return { effectiveRes, erAmend };
  }

  let valueLower = 0;
  let valueUpper = 250;
  let amendLower = 0;
  let amendUpper = 0.25;

  if (effectiveRes <= 250) {
    valueLower = 0;
    valueUpper = 250;
    amendLower = 0;
    amendUpper = 0.25;
  } else if (effectiveRes <= 750) {
    valueLower = 251;
    valueUpper = 750;
    amendLower = 0.35;
    amendUpper = 0.6;
  } else {
    valueLower = 751;
    valueUpper = 2000;
    amendLower = 0.9;
    amendUpper = 0.99;
  }

  const clampedRes = Math.min(2000, effectiveRes);
  const ratio = (clampedRes - valueLower) / (valueUpper - valueLower);
  const resReduction = amendLower + (amendUpper - amendLower) * (ratio * ratio);
  const erAmend = Math.max(0.01, 1 - resReduction);

  return { effectiveRes, erAmend };
}

export interface DiscAndNoteContributions {
  discBaseAtk: number;
  discBaseHp: number;
  discElementDmgPct: Record<ElementType, number>;
  discTypeDmgPct: Record<DamageType, number>;
  noteAtkPct: number;
  noteCritRatePct: number;
  noteCritDmgPct: number;
  noteHpPct: number;
  noteElementDmgPct: Record<ElementType, number>;
  noteTypeDmgPct: Record<DamageType, number>;
}

export function computePresetContributions(
  mainDiscs: SelectedMainDisc[],
  supportDiscs: SelectedSupportDisc[],
  totalNotes: Partial<Record<NoteName, number>>,
  discsMap: Record<string, SSDisc>
): DiscAndNoteContributions {
  const discElementDmgPct = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementType, number>;
  const noteElementDmgPct = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementType, number>;

  const discTypeDmgPct = Object.fromEntries(DAMAGE_TYPES.map((t) => [t, 0])) as Record<DamageType, number>;
  const noteTypeDmgPct = Object.fromEntries(DAMAGE_TYPES.map((t) => [t, 0])) as Record<DamageType, number>;

  let discBaseAtk = 0;
  let discBaseHp = 0;

  const accumulateDiscStats = (discId: number | null, level: 1 | 80 | 90, crescendo = 1) => {
    if (!discId) return;
    const disc = discsMap[String(discId)];
    if (!disc) return;
    const statTier = level === 1 ? disc.stats.lv1 : level === 80 ? disc.stats.lv80 : disc.stats.lv90;
    const baseAtk = Number(statTier?.ATK) || 0;
    // Dupe flat ATK (crescendo 1 = base, crescendo 2..6 = dupeAtk[0..4])
    const dupeBonus = crescendo > 1 ? Number(disc.dupeAtk?.[crescendo - 2]) || 0 : 0;
    discBaseAtk += baseAtk + dupeBonus;
    discBaseHp += Number(statTier?.HP) || 0;

    // Secondary base stats on the disc (e.g. 'Ignis DMG': '15%' or 'Skill DMG': '15%')
    for (const [key, rawVal] of Object.entries(statTier || {})) {
      if (key === 'ATK' || key === 'HP') continue;
      const numVal = parseFloat(String(rawVal)) || 0;
      if (numVal <= 0) continue;
      for (const el of ELEMENTS) {
        if (key === `${el} DMG`) discElementDmgPct[el] += numVal;
      }
      if (key === 'Auto Attack DMG') discTypeDmgPct['Auto Attack'] += numVal;
      if (key === 'Skill DMG') discTypeDmgPct['Skill'] += numVal;
      if (key === 'Ultimate DMG') discTypeDmgPct['Ultimate'] += numVal;
    }
  };

  for (const m of mainDiscs) {
    accumulateDiscStats(m.discId, m.level, m.crescendo);
  }
  for (const s of supportDiscs) {
    // Support discs also contribute their Base ATK and dupe flat ATK to the squad.
    accumulateDiscStats(s.discId, s.level, s.crescendo || 1);
  }

  let noteAtkPct = 0;
  let noteCritRatePct = 0;
  let noteCritDmgPct = 0;
  let noteHpPct = 0;

  for (const noteMeta of MUSICAL_NOTES) {
    const count = Math.max(0, Number(totalNotes[noteMeta.name]) || 0);
    if (count === 0) continue;
    const totalBonus = +(count * noteMeta.perLevelPct).toFixed(2);
    switch (noteMeta.statKey) {
      case 'atkPct':
        noteAtkPct += totalBonus;
        break;
      case 'critRate':
        noteCritRatePct += totalBonus;
        break;
      case 'critDmg':
        noteCritDmgPct += totalBonus;
        break;
      case 'hpPct':
        noteHpPct += totalBonus;
        break;
      case 'autoAtkDmg':
        noteTypeDmgPct['Auto Attack'] += totalBonus;
        break;
      case 'skillDmg':
        noteTypeDmgPct['Skill'] += totalBonus;
        break;
      case 'ultDmg':
        noteTypeDmgPct['Ultimate'] += totalBonus;
        break;
      case 'ignisDmg':
        noteElementDmgPct.Ignis += totalBonus;
        break;
      case 'aquaDmg':
        noteElementDmgPct.Aqua += totalBonus;
        break;
      case 'terraDmg':
        noteElementDmgPct.Terra += totalBonus;
        break;
      case 'ventusDmg':
        noteElementDmgPct.Ventus += totalBonus;
        break;
      case 'luxDmg':
        noteElementDmgPct.Lux += totalBonus;
        break;
      case 'umbraDmg':
        noteElementDmgPct.Umbra += totalBonus;
        break;
    }
  }

  return {
    discBaseAtk,
    discBaseHp,
    discElementDmgPct,
    discTypeDmgPct,
    noteAtkPct,
    noteCritRatePct,
    noteCritDmgPct,
    noteHpPct,
    noteElementDmgPct,
    noteTypeDmgPct,
  };
}

/* ------------------------------------------------------------------ */
/* Advanced team-damage model                                          */
/* ------------------------------------------------------------------ */

export type BuffStatKey =
  | 'baseAtk'
  | 'baseHp'
  | 'baseDef'
  | 'atkPctPerma'
  | 'atkPct'
  | 'hpPct'
  | 'defPct'
  | 'elementDmg'
  | 'elementTaken'
  | 'critRate'
  | 'critDmg'
  | 'aaCritRate'
  | 'skillCritRate'
  | 'ultCritRate'
  | 'markCritRate'
  | 'minionCritRate'
  | 'aaCritDmg'
  | 'skillCritDmg'
  | 'ultCritDmg'
  | 'markCritDmg'
  | 'minionCritDmg'
  | 'aaDmg'
  | 'skillDmg'
  | 'ultDmg'
  | 'markDmg'
  | 'minionDmg'
  | 'aaTaken'
  | 'skillTaken'
  | 'ultTaken'
  | 'markTaken'
  | 'minionTaken'
  | 'defPen'
  | 'defPenPct'
  | 'defIgnore'
  | 'defReduction'
  | 'resPen'
  | 'resIgnore'
  | 'vul'
  | 'skillIntensity'
  | 'customMultiplier'
  | 'breakDmg';

export interface BuffStatOption {
  key: BuffStatKey;
  label: string;
  group: string;
  percent: boolean;
}

export const BUFF_STAT_OPTIONS: BuffStatOption[] = [
  { key: 'baseAtk', label: 'Base ATK', group: 'Base stats', percent: false },
  { key: 'baseHp', label: 'Base HP', group: 'Base stats', percent: false },
  { key: 'baseDef', label: 'Base DEF', group: 'Base stats', percent: false },
  { key: 'atkPctPerma', label: 'ATK% (Permanent)', group: 'Base stats', percent: true },
  { key: 'atkPct', label: 'ATK%', group: 'Base stats', percent: true },
  { key: 'hpPct', label: 'HP%', group: 'Base stats', percent: true },
  { key: 'defPct', label: 'DEF%', group: 'Base stats', percent: true },
  { key: 'critRate', label: 'Crit Rate%', group: 'Base stats', percent: true },
  { key: 'critDmg', label: 'Crit DMG%', group: 'Base stats', percent: true },

  { key: 'aaCritRate', label: 'Auto Attack Crit Rate%', group: 'Specific crits', percent: true },
  { key: 'skillCritRate', label: 'Skill Crit Rate%', group: 'Specific crits', percent: true },
  { key: 'ultCritRate', label: 'Ultimate Crit Rate%', group: 'Specific crits', percent: true },
  { key: 'markCritRate', label: 'Mark Crit Rate%', group: 'Specific crits', percent: true },
  { key: 'minionCritRate', label: 'Minion Crit Rate%', group: 'Specific crits', percent: true },
  { key: 'aaCritDmg', label: 'Auto Attack Crit DMG%', group: 'Specific crits', percent: true },
  { key: 'skillCritDmg', label: 'Skill Crit DMG%', group: 'Specific crits', percent: true },
  { key: 'ultCritDmg', label: 'Ultimate Crit DMG%', group: 'Specific crits', percent: true },
  { key: 'markCritDmg', label: 'Mark Crit DMG%', group: 'Specific crits', percent: true },
  { key: 'minionCritDmg', label: 'Minion Crit DMG%', group: 'Specific crits', percent: true },

  { key: 'elementDmg', label: 'Element DMG%', group: 'Damage bonuses', percent: true },
  { key: 'aaDmg', label: 'Auto Attack DMG%', group: 'Damage bonuses', percent: true },
  { key: 'skillDmg', label: 'Skill DMG%', group: 'Damage bonuses', percent: true },
  { key: 'ultDmg', label: 'Ultimate DMG%', group: 'Damage bonuses', percent: true },
  { key: 'markDmg', label: 'Mark DMG%', group: 'Damage bonuses', percent: true },
  { key: 'minionDmg', label: 'Minion DMG%', group: 'Damage bonuses', percent: true },
  { key: 'skillIntensity', label: 'Skill Intensity%', group: 'Damage bonuses', percent: true },
  { key: 'customMultiplier', label: 'Custom Multiplier%', group: 'Damage bonuses', percent: true },

  { key: 'elementTaken', label: 'Element DMG Taken%', group: 'Enemy debuffs', percent: true },
  { key: 'aaTaken', label: 'Auto Attack Taken%', group: 'Enemy debuffs', percent: true },
  { key: 'skillTaken', label: 'Skill Taken%', group: 'Enemy debuffs', percent: true },
  { key: 'ultTaken', label: 'Ultimate Taken%', group: 'Enemy debuffs', percent: true },
  { key: 'markTaken', label: 'Mark Taken%', group: 'Enemy debuffs', percent: true },
  { key: 'minionTaken', label: 'Minion Taken%', group: 'Enemy debuffs', percent: true },

  { key: 'defPen', label: 'DEF PEN (flat)', group: 'Enemy mitigation', percent: false },
  { key: 'defPenPct', label: 'DEF PEN%', group: 'Enemy mitigation', percent: true },
  { key: 'defIgnore', label: 'DEF Ignore%', group: 'Enemy mitigation', percent: true },
  { key: 'defReduction', label: 'DEF Reduction (flat)', group: 'Enemy mitigation', percent: false },
  { key: 'resPen', label: 'RES PEN (flat)', group: 'Enemy mitigation', percent: false },
  { key: 'resIgnore', label: 'RES Ignore%', group: 'Enemy mitigation', percent: true },
  { key: 'vul', label: 'VUL / Suppress%', group: 'Enemy mitigation', percent: true },
  { key: 'breakDmg', label: 'Resilience Break DMG%', group: 'Enemy mitigation', percent: true },
];

const TYPE_DMG_KEYS: Partial<Record<BuffStatKey, DamageType>> = {
  aaDmg: 'Auto Attack',
  skillDmg: 'Skill',
  ultDmg: 'Ultimate',
  markDmg: 'Mark',
  minionDmg: 'Minion',
};

const TYPE_TAKEN_KEYS: Partial<Record<BuffStatKey, DamageType>> = {
  aaTaken: 'Auto Attack',
  skillTaken: 'Skill',
  ultTaken: 'Ultimate',
  markTaken: 'Mark',
  minionTaken: 'Minion',
};

const TYPE_CRIT_RATE_KEYS: Partial<Record<BuffStatKey, DamageType>> = {
  aaCritRate: 'Auto Attack',
  skillCritRate: 'Skill',
  ultCritRate: 'Ultimate',
  markCritRate: 'Mark',
  minionCritRate: 'Minion',
};

const TYPE_CRIT_DMG_KEYS: Partial<Record<BuffStatKey, DamageType>> = {
  aaCritDmg: 'Auto Attack',
  skillCritDmg: 'Skill',
  ultCritDmg: 'Ultimate',
  markCritDmg: 'Mark',
  minionCritDmg: 'Minion',
};

export interface StatBlock {
  baseAtk: number;
  baseHp: number;
  baseDef: number;
  atkPctPerma: number;
  atkPct: number;
  hpPct: number;
  defPct: number;
  elementDmgPct: number;
  elementTakenPct: number;
  critRatePct: number;
  critDmgPct: number;
  typeCritRatePct: Record<DamageType, number>;
  typeCritDmgPct: Record<DamageType, number>;
  typeDmgPct: Record<DamageType, number>;
  typeTakenPct: Record<DamageType, number>;
  defPen: number;
  defPenPct: number;
  defIgnorePct: number;
  defReduction: number;
  resPen: number;
  resIgnorePct: number;
  vulPct: number;
  skillIntensityPct: number;
  customMultiplierPct: number;
  resilienceBreakDmgPct: number;
}

export function createEmptyTypeRecord(): Record<DamageType, number> {
  return Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 0])) as Record<DamageType, number>;
}

export function createEmptyStatBlock(): StatBlock {
  return {
    baseAtk: 0,
    baseHp: 0,
    baseDef: 0,
    atkPctPerma: 0,
    atkPct: 0,
    hpPct: 0,
    defPct: 0,
    elementDmgPct: 0,
    elementTakenPct: 0,
    critRatePct: 0,
    critDmgPct: 0,
    typeCritRatePct: createEmptyTypeRecord(),
    typeCritDmgPct: createEmptyTypeRecord(),
    typeDmgPct: createEmptyTypeRecord(),
    typeTakenPct: createEmptyTypeRecord(),
    defPen: 0,
    defPenPct: 0,
    defIgnorePct: 0,
    defReduction: 0,
    resPen: 0,
    resIgnorePct: 0,
    vulPct: 0,
    skillIntensityPct: 0,
    customMultiplierPct: 0,
    resilienceBreakDmgPct: 0,
  };
}

export function applyBuffStat(target: StatBlock, key: BuffStatKey, value: number): void {
  const amount = Number.isFinite(value) ? value : 0;
  const typeDmg = TYPE_DMG_KEYS[key];
  if (typeDmg) {
    target.typeDmgPct[typeDmg] += amount;
    return;
  }
  const typeTaken = TYPE_TAKEN_KEYS[key];
  if (typeTaken) {
    target.typeTakenPct[typeTaken] += amount;
    return;
  }
  const typeCritRate = TYPE_CRIT_RATE_KEYS[key];
  if (typeCritRate) {
    target.typeCritRatePct[typeCritRate] += amount;
    return;
  }
  const typeCritDmg = TYPE_CRIT_DMG_KEYS[key];
  if (typeCritDmg) {
    target.typeCritDmgPct[typeCritDmg] += amount;
    return;
  }

  switch (key) {
    case 'baseAtk':
      target.baseAtk += amount;
      break;
    case 'baseHp':
      target.baseHp += amount;
      break;
    case 'baseDef':
      target.baseDef += amount;
      break;
    case 'atkPctPerma':
      target.atkPctPerma += amount;
      break;
    case 'atkPct':
      target.atkPct += amount;
      break;
    case 'hpPct':
      target.hpPct += amount;
      break;
    case 'defPct':
      target.defPct += amount;
      break;
    case 'elementDmg':
      target.elementDmgPct += amount;
      break;
    case 'elementTaken':
      target.elementTakenPct += amount;
      break;
    case 'critRate':
      target.critRatePct += amount;
      break;
    case 'critDmg':
      target.critDmgPct += amount;
      break;
    case 'defPen':
      target.defPen += amount;
      break;
    case 'defPenPct':
      target.defPenPct += amount;
      break;
    case 'defIgnore':
      target.defIgnorePct += amount;
      break;
    case 'defReduction':
      target.defReduction += amount;
      break;
    case 'resPen':
      target.resPen += amount;
      break;
    case 'resIgnore':
      target.resIgnorePct += amount;
      break;
    case 'vul':
      target.vulPct += amount;
      break;
    case 'skillIntensity':
      target.skillIntensityPct += amount;
      break;
    case 'customMultiplier':
      target.customMultiplierPct += amount;
      break;
    case 'breakDmg':
      target.resilienceBreakDmgPct += amount;
      break;
  }
}

export interface CharacterStatInput {
  characterBaseAtk: number;
  characterBaseHp?: number;
  characterBaseDef?: number;
  affinityLevel: number;
  recordLevel: number;
  squadDiscBaseAtk: number;
  squadDiscBaseHp?: number;
  element: ElementType;
  bonuses: StatBlock;
}

export interface CharacterStats {
  element: ElementType;
  baseAtk: number;
  baseAtkParts: {
    character: number;
    affinity: number;
    record: number;
    discs: number;
    bonus: number;
  };
  affinityAtkPct: number;
  atkPctPerma: number;
  atkPct: number;
  totalAtkPct: number;
  finalAtk: number;

  baseHp: number;
  hpPct: number;
  finalHp: number;
  baseDef: number;
  defPct: number;
  finalDef: number;

  elementDmgPct: number;
  elementTakenPct: number;
  critRatePct: number;
  critDmgPct: number;
  typeCritRatePct: Record<DamageType, number>;
  typeCritDmgPct: Record<DamageType, number>;

  typeDmgPct: Record<DamageType, number>;
  typeTakenPct: Record<DamageType, number>;

  defPen: number;
  defPenPct: number;
  defIgnorePct: number;
  defReduction: number;
  resPen: number;
  resIgnorePct: number;
  vulPct: number;

  skillIntensityPct: number;
  customMultiplierPct: number;
  resilienceBreakDmgPct: number;
}

export function buildCharacterStats(input: CharacterStatInput): CharacterStats {
  const affinity = getAffinityBonuses(input.affinityLevel);
  const record = RECORD_LEVEL_BASE_ATK[input.recordLevel] ?? 0;
  const baseAtkParts = {
    character: Math.max(0, input.characterBaseAtk),
    affinity: affinity.baseAtk,
    record,
    discs: Math.max(0, input.squadDiscBaseAtk),
    bonus: input.bonuses.baseAtk,
  };
  const baseAtk =
    baseAtkParts.character +
    baseAtkParts.affinity +
    baseAtkParts.record +
    baseAtkParts.discs +
    baseAtkParts.bonus;

  const atkPctPerma = affinity.atkPct + input.bonuses.atkPctPerma;
  const atkPct = input.bonuses.atkPct;
  const totalAtkPct = atkPctPerma + atkPct;

  const baseHp =
    Math.max(0, input.characterBaseHp ?? 0) +
    Math.max(0, input.squadDiscBaseHp ?? 0) +
    input.bonuses.baseHp;
  const hpPct = input.bonuses.hpPct;
  const baseDef = Math.max(0, input.characterBaseDef ?? 0) + input.bonuses.baseDef;
  const defPct = input.bonuses.defPct;

  return {
    element: input.element,
    baseAtk,
    baseAtkParts,
    affinityAtkPct: affinity.atkPct,
    atkPctPerma,
    atkPct,
    totalAtkPct,
    finalAtk: baseAtk * (1 + totalAtkPct / 100),

    baseHp,
    hpPct,
    finalHp: baseHp * (1 + hpPct / 100),
    baseDef,
    defPct,
    finalDef: baseDef * (1 + defPct / 100),

    elementDmgPct: input.bonuses.elementDmgPct,
    elementTakenPct: input.bonuses.elementTakenPct,
    critRatePct: 5 + input.bonuses.critRatePct,
    critDmgPct: 150 + input.bonuses.critDmgPct,

    typeCritRatePct: { ...input.bonuses.typeCritRatePct },
    typeCritDmgPct: { ...input.bonuses.typeCritDmgPct },
    typeDmgPct: { ...input.bonuses.typeDmgPct },
    typeTakenPct: { ...input.bonuses.typeTakenPct },

    defPen: input.bonuses.defPen,
    defPenPct: input.bonuses.defPenPct,
    defIgnorePct: input.bonuses.defIgnorePct,
    defReduction: input.bonuses.defReduction,
    resPen: input.bonuses.resPen,
    resIgnorePct: input.bonuses.resIgnorePct,
    vulPct: input.bonuses.vulPct,

    skillIntensityPct: input.bonuses.skillIntensityPct,
    customMultiplierPct: input.bonuses.customMultiplierPct,
    resilienceBreakDmgPct: input.bonuses.resilienceBreakDmgPct,
  };
}

export type ScalingStat = 'ATK' | 'HP' | 'DEF';

export interface AbilityInput {
  name: string;
  motionValuePct: number;
  hits: number;
  casts: number;
  damageType: DamageType;
  scalingStat?: ScalingStat;
}

export interface EnemyInput {
  def: number;
  res: number;
  resilienceBroken: boolean;
}

export interface AbilityDamageResult {
  ability: AbilityInput;
  scalingStat: ScalingStat;
  effectiveStat: number;
  totalHits: number;
  motionValueMult: number;
  elementMult: number;
  elementTakenMult: number;
  typeMult: number;
  typeTakenMult: number;
  skillIntensityMult: number;
  customMultiplier: number;
  critMult: number;
  expectedCritMult: number;
  breakMult: number;
  effectiveDef: number;
  defAmend: number;
  effectiveRes: number;
  erAmend: number;
  nonCritDamage: number;
  critDamage: number;
  expectedDamage: number;
}

/**
 * Full gist damage formula, with the expected-value crit term used for the
 * headline number:
 *   ATK x MV x Intensity x SlotDMG x ElementDMG
 *   x Crit x (erAmend x defAmend x SlotTaken x ElementTaken x Break)
 */
export function calculateAbilityDamage(
  stats: CharacterStats,
  ability: AbilityInput,
  enemy: EnemyInput
): AbilityDamageResult {
  const hits = Math.max(0, ability.hits);
  const casts = Math.max(0, ability.casts);
  const totalHits = hits * casts;

  const motionValueMult = (Math.max(0, ability.motionValuePct) / 100) * totalHits;
  const elementMult = 1 + stats.elementDmgPct / 100;
  const elementTakenMult = 1 + stats.elementTakenPct / 100;
  const typeMult = 1 + (stats.typeDmgPct[ability.damageType] || 0) / 100;
  const typeTakenMult = 1 + (stats.typeTakenPct[ability.damageType] || 0) / 100;
  const skillIntensityMult = 1 + stats.skillIntensityPct / 100;
  const customMultiplier = 1 + stats.customMultiplierPct / 100;

  const critRate =
    Math.max(
      0,
      Math.min(100, stats.critRatePct + (stats.typeCritRatePct[ability.damageType] || 0))
    ) / 100;
  const critMult = Math.max(
    1,
    (stats.critDmgPct + (stats.typeCritDmgPct[ability.damageType] || 0)) / 100
  );
  const expectedCritMult = 1 + critRate * (critMult - 1);

  const breakMult = enemy.resilienceBroken
    ? 1.5 * (1 + stats.resilienceBreakDmgPct / 100)
    : 1;

  const scalingStat = ability.scalingStat ?? 'ATK';
  // Minions inherit multiplicative permanent and dynamic ATK; every other
  // source and every HP/DEF source uses the normal additive total.
  const effectiveStat =
    scalingStat === 'HP'
      ? stats.finalHp
      : scalingStat === 'DEF'
        ? stats.finalDef
        : ability.damageType === 'Minion'
          ? stats.baseAtk * (1 + stats.atkPctPerma / 100) * (1 + stats.atkPct / 100)
          : stats.finalAtk;

  const { effectiveDef, defAmend } = calculateDefAmend(
    enemy.def,
    stats.defReduction,
    stats.defPen,
    stats.defIgnorePct,
    stats.defPenPct
  );
  const { effectiveRes, erAmend } = calculateResAmend(
    enemy.res,
    stats.resPen,
    stats.vulPct,
    stats.resIgnorePct
  );

  const baseHit =
    effectiveStat *
    motionValueMult *
    skillIntensityMult *
    typeMult *
    elementMult *
    customMultiplier *
    breakMult *
    defAmend *
    erAmend *
    typeTakenMult *
    elementTakenMult;

  return {
    ability,
    scalingStat,
    effectiveStat,
    totalHits,
    motionValueMult,
    elementMult,
    elementTakenMult,
    typeMult,
    typeTakenMult,
    skillIntensityMult,
    customMultiplier,
    critMult,
    expectedCritMult,
    breakMult,
    effectiveDef,
    defAmend,
    effectiveRes,
    erAmend,
    nonCritDamage: Math.round(baseHit),
    critDamage: Math.round(baseHit * critMult),
    expectedDamage: Math.round(baseHit * expectedCritMult),
  };
}
