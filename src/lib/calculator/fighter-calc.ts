import type { ElementType, SSCharacter } from '../../types/index.ts';
import {
  EMBLEM_LEVELS,
  getEmblemStatMeta,
  getEmblemValue,
  getTalentKey,
  getTalentMinorStatBonuses,
  getTalentTiers,
  mapTalentRow,
  resolveTalentTarget,
} from './talent-emblem.ts';
import type { EmblemLevel, EmblemRowState } from './talent-emblem.ts';
import {
  applyBuffStat,
  buildCharacterStats,
  calculateAbilityDamage,
  calculateDefAmend,
  calculateResAmend,
  createEmptyStatBlock,
  DAMAGE_TYPES,
} from './damage-engine.ts';
import type {
  AbilityDamageResult,
  AbilityInput,
  BuffStatKey,
  CharacterStats,
  DamageType,
  DiscAndNoteContributions,
  EnemyInput,
  StatBlock,
} from './damage-engine.ts';

export type SlotKey = 'vanguard' | 'versatile' | 'support';
export type BuffTarget = 'team' | SlotKey;
export type TrekkerLevel = '90' | '80' | '70' | '1';

export interface CombatSkillEntry {
  name: string;
  desc?: string;
  params: string[];
  icon?: string;
}

export interface CharacterCombatEntry {
  id: number;
  name: string;
  star: number;
  element: ElementType;
  class: string;
  stats: Record<string, { atk: number; hp: number; def?: number; vul: number }>;
  normalAtk?: CombatSkillEntry;
  skill?: CombatSkillEntry;
  supportSkill?: CombatSkillEntry;
  ultimate?: CombatSkillEntry;
}

export interface RotationAbility extends AbilityInput {
  id: string;
  source: 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate' | 'custom';
  partId?: string;
  name: string;
  icon?: string;
  note?: string;
}

export interface FighterStateInput {
  slot: SlotKey;
  level: TrekkerLevel;
  skillLevel: number;
  affinityLevel: number;
  talentTier: number;
  emblems: Record<EmblemLevel, EmblemRowState[]>;
  rotation: RotationAbility[];
}

export interface FighterInput {
  state: FighterStateInput;
  character: SSCharacter | null;
  combat: CharacterCombatEntry | null;
}

export interface TeamBuffInput {
  target: BuffTarget;
  stat: BuffStatKey;
  value: number;
  realisticUptime?: number;
}

export interface TeamCalcInput {
  fighters: FighterInput[];
  contributions: DiscAndNoteContributions;
  buffs: TeamBuffInput[];
  recordLevel: number;
  enemy: EnemyInput;
}

export interface FighterCalcTotals {
  expected: number;
  nonCrit: number;
  crit: number;
  hits: number;
}

export interface FighterCalc {
  state: FighterStateInput;
  character: SSCharacter | null;
  combat: CharacterCombatEntry | null;
  element: ElementType;
  stats: CharacterStats;
  effectiveDef: number;
  defAmend: number;
  effectiveRes: number;
  erAmend: number;
  abilities: Array<{ entry: RotationAbility; damage: AbilityDamageResult }>;
  totals: FighterCalcTotals;
}

export interface TeamCalcResult {
  fighters: FighterCalc[];
  totalExpected: number;
  totalNonCrit: number;
  totalCrit: number;
  totalHits: number;
}

function buildPresetBonusBlock(
  element: ElementType,
  contributions: DiscAndNoteContributions
): StatBlock {
  const bonuses = createEmptyStatBlock();
  bonuses.atkPctPerma = contributions.noteAtkPct;
  bonuses.hpPct = contributions.noteHpPct;
  bonuses.critRatePct = contributions.noteCritRatePct;
  bonuses.critDmgPct = contributions.noteCritDmgPct;
  bonuses.elementDmgPct =
    (contributions.discElementDmgPct[element] || 0) +
    (contributions.noteElementDmgPct[element] || 0);

  for (const type of DAMAGE_TYPES) {
    bonuses.typeDmgPct[type] =
      (contributions.discTypeDmgPct[type] || 0) +
      (contributions.noteTypeDmgPct[type] || 0);
  }

  return bonuses;
}

interface ResolvedFighter extends FighterInput {
  element: ElementType;
  talentKey: string;
}

/**
 * Apply every fighter's unlocked talent tiers to every fighter they target.
 * Talents are team-wide in the spreadsheet: a support's "Squad" row also
 * buffs the vanguard. Element-scoped rows only land on matching elements.
 */
function applyTalents(recipient: ResolvedFighter, roster: ResolvedFighter[], bonuses: StatBlock): void {
  for (const source of roster) {
    if (!source.character) continue;
    const tiers = getTalentTiers(String(source.character.id), source.character.name.EN);

    for (let tier = 0; tier < source.state.talentTier && tier < tiers.length; tier++) {
      for (const row of tiers[tier] ?? []) {
        const bonus = mapTalentRow(row);
        if (!bonus) continue;

        const target = resolveTalentTarget(bonus.target, {
          slot: source.state.slot,
          element: source.element,
          talentKey: source.talentKey,
        });

        const applies =
          target.kind === 'all' ||
          (target.kind === 'main' && recipient.state.slot === 'vanguard') ||
          (target.kind === 'element' && target.element === recipient.element) ||
          (target.kind === 'slot' && target.slot === recipient.state.slot);

        if (!applies) continue;
        if (bonus.element && bonus.element !== recipient.element) continue;
        applyBuffStat(bonuses, bonus.key, bonus.value);
      }
    }
  }

  if (recipient.character && recipient.state.talentTier > 0) {
    for (const minor of getTalentMinorStatBonuses(
      String(recipient.character.id),
      recipient.state.talentTier
    )) {
      applyBuffStat(bonuses, minor.key, minor.value);
    }
  }
}

function isHpScaler(combat: CharacterCombatEntry | null, rotation: RotationAbility[]): boolean {
  if (rotation.some((r) => r.scalingStat === 'HP')) return true;
  if (combat?.id === 162) return true;
  const skillDesc = combat?.skill?.desc ?? '';
  const normalDesc = combat?.normalAtk?.desc ?? '';
  return /\bof\s+(?:Base\s+|Max\s+)?HP\b/i.test(skillDesc) || /\bof\s+(?:Base\s+|Max\s+)?HP\b/i.test(normalDesc);
}

export function calculateTeam(input: TeamCalcInput): TeamCalcResult {
  const roster: ResolvedFighter[] = input.fighters.map((fighter) => ({
    ...fighter,
    element: fighter.character?.element ?? fighter.combat?.element ?? 'Ignis',
    talentKey: fighter.character
      ? getTalentKey(String(fighter.character.id), fighter.character.name.EN)
      : '',
  }));

  const fighters = roster.map((fighter): FighterCalc => {
    const { state, character, combat, element } = fighter;
    const levelStats = combat?.stats?.[state.level] ?? combat?.stats?.['90'];

    const bonuses = buildPresetBonusBlock(element, input.contributions);
    if (levelStats?.vul) bonuses.vulPct += Number(levelStats.vul) || 0;

    applyTalents(fighter, roster, bonuses);

    // Emblems: this fighter's own level 70/80/90 rows.
    for (const level of EMBLEM_LEVELS) {
      for (const row of state.emblems[level]) {
        if (!row.stat) continue;
        const meta = getEmblemStatMeta(row.stat);
        if (!meta?.key) continue;
        const value = getEmblemValue(level, row.stat, row.rarity);
        applyBuffStat(bonuses, meta.key, meta.percent ? value * 100 : value);
      }
    }

    for (const buff of input.buffs) {
      if (buff.target === 'team' || buff.target === state.slot) {
        applyBuffStat(bonuses, buff.stat, buff.value);
      }
    }

    const stats = buildCharacterStats({
      characterBaseAtk: Number(levelStats?.atk) || 0,
      characterBaseHp: Number(levelStats?.hp) || 0,
      characterBaseDef: Number(levelStats?.def) || 0,
      affinityLevel: state.affinityLevel,
      recordLevel: input.recordLevel,
      squadDiscBaseAtk: input.contributions.discBaseAtk,
      squadDiscBaseHp: input.contributions.discBaseHp,
      element,
      primaryScalingStat: isHpScaler(combat, state.rotation) ? 'HP' : 'ATK',
      bonuses,
    });

    const abilities = state.rotation.map((entry) => {
      const damage = calculateAbilityDamage(
        stats,
        {
          name: entry.name,
          motionValuePct: entry.motionValuePct,
          hits: entry.hits,
          casts: entry.casts,
          damageType: entry.damageType,
          scalingStat: entry.scalingStat,
        },
        input.enemy
      );
      return { entry, damage };
    });

    const totals = abilities.reduce<FighterCalcTotals>(
      (accumulator, { damage }) => ({
        expected: accumulator.expected + damage.expectedDamage,
        nonCrit: accumulator.nonCrit + damage.nonCritDamage,
        crit: accumulator.crit + damage.critDamage,
        hits: accumulator.hits + damage.totalHits,
      }),
      { expected: 0, nonCrit: 0, crit: 0, hits: 0 }
    );

    const defInfo = calculateDefAmend(
      input.enemy.def,
      stats.defReduction,
      stats.defPen,
      stats.defIgnorePct,
      stats.defPenPct
    );
    const resInfo = calculateResAmend(
      input.enemy.res,
      stats.resPen,
      stats.vulPct,
      stats.resIgnorePct
    );

    return {
      state,
      character,
      combat,
      element,
      stats,
      effectiveDef: defInfo.effectiveDef,
      defAmend: defInfo.defAmend,
      effectiveRes: resInfo.effectiveRes,
      erAmend: resInfo.erAmend,
      abilities,
      totals,
    };
  });

  return {
    fighters,
    totalExpected: fighters.reduce((sum, fighter) => sum + fighter.totals.expected, 0),
    totalNonCrit: fighters.reduce((sum, fighter) => sum + fighter.totals.nonCrit, 0),
    totalCrit: fighters.reduce((sum, fighter) => sum + fighter.totals.crit, 0),
    totalHits: fighters.reduce((sum, fighter) => sum + fighter.totals.hits, 0),
  };
}

export interface DamageSourceSummary {
  label: string;
  value: number;
}

/**
 * Resolve the canonical skill label for a rotation row so multi-part hits
 * (e.g. "Immediate Execution #1/#2/(Mark)" or "Divine") and duplicate rows
 * collapse cleanly under one skill name.
 */
export function resolveAbilitySourceLabel(
  entry: Pick<RotationAbility, 'source' | 'name'>,
  combat: CharacterCombatEntry | null
): string {
  if (entry.source !== 'custom') {
    const skillName = combat?.[entry.source]?.name?.trim();
    if (skillName) return skillName;
  }
  const normalized = entry.name.trim().replace(/\s+\(#\d+\)$/, '').trim();
  return normalized || 'Custom ability';
}

/**
 * Merge rotation rows belonging to the same skill into a single damage source,
 * summing expected damage and sorting largest contributor first.
 */
export function aggregateDamageSources(
  abilities: Array<{
    entry: Pick<RotationAbility, 'source' | 'name'>;
    damage: { expectedDamage: number };
  }>,
  combat: CharacterCombatEntry | null
): DamageSourceSummary[] {
  const buckets = new Map<string, DamageSourceSummary>();
  for (const { entry, damage } of abilities) {
    if (damage.expectedDamage <= 0) continue;
    const label = resolveAbilitySourceLabel(entry, combat);
    const key = label.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.value += damage.expectedDamage;
    } else {
      buckets.set(key, { label, value: damage.expectedDamage });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.value - a.value);
}

/**
 * Format a compact, non-redundant label for a skill's Part dropdown by stripping
 * the parent skill name prefix (e.g. "Immediate Execution (Mark)" -> "Mark · 125%",
 * "Glorious Smite" -> "Main hit · 771%").
 */
export function formatPartOptionLabel(
  skillName: string,
  part: { label: string; mvPct: number; damageType: DamageType }
): string {
  const s = skillName.trim();
  const l = part.label.trim();
  let short = l;

  if (s && l.toLowerCase() === s.toLowerCase()) {
    short = part.damageType === 'Ultimate' ? 'Main hit' : part.damageType;
  } else if (s && l.toLowerCase().startsWith(s.toLowerCase())) {
    const rest = l.slice(s.length).replace(/^[\s:\-–—]+/, '').trim();
    if (rest) {
      const unwrapped = rest.replace(/^\(([^()]+)\)$/, '$1').trim();
      short = unwrapped || rest;
    }
  }

  return `${short} · ${part.mvPct}%`;
}
