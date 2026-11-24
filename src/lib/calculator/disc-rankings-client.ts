import { calculateSupportStartingNotes } from '../../data/notes.ts';
import type { DiscRankRow, DiscRankingsData } from '../community-analytics-utils.ts';
import type { AdvancedPresetData } from '../preset-code.ts';
import type {
  ElementType,
  NoteName,
  SSCharacter,
  SSDisc,
  SelectedMainDisc,
  SelectedSupportDisc,
} from '../../types/index.ts';

/**
 * Infers the dominant squad element from equipped Main Discs (+2 each) and
 * occupied Trekker slots (+1.5 Vanguard/Versatile, +1 Support), falling back to
 * the first occupied Trekker's element or 'Ignis'.
 */
export function inferSquadElement(
  advData: Pick<AdvancedPresetData, 'slots' | 'mainDiscs'>,
  allCharacters: Record<string, SSCharacter>,
  allDiscs: Record<string, SSDisc>
): ElementType {
  const counts: Partial<Record<ElementType, number>> = {};
  for (const md of advData.mainDiscs ?? []) {
    const disc = md?.discId ? allDiscs[String(md.discId)] : undefined;
    if (disc?.element && disc.element !== 'None') {
      const el = disc.element as ElementType;
      counts[el] = (counts[el] ?? 0) + 2;
    }
  }
  const slotWeights: ReadonlyArray<[SlotKey, number]> = [
    ['vanguard', 1.5],
    ['versatile', 1.5],
    ['support', 1],
  ];
  let firstCharElement: ElementType | null = null;
  for (const [slot, w] of slotWeights) {
    const cid = advData.slots?.[slot]?.characterId;
    const ch = cid ? allCharacters[String(cid)] : undefined;
    if (ch?.element && (ch.element as string) !== 'None') {
      if (!firstCharElement) firstCharElement = ch.element;
      counts[ch.element] = (counts[ch.element] ?? 0) + w;
    }
  }
  let best: ElementType | null = null;
  let bestScore = -1;
  for (const [el, score] of Object.entries(counts) as Array<[ElementType, number]>) {
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best ?? firstCharElement ?? 'Ignis';
}
import {
  computePresetContributions,
  type BuffStatKey,
  type DamageType,
  type ScalingStat,
} from './damage-engine.ts';
import {
  calculateTeam,
  type CharacterCombatEntry,
  type FighterInput,
  type RotationAbility,
  type SlotKey,
  type TeamBuffInput,
  type TeamCalcResult,
} from './fighter-calc.ts';
import {
  extractDiscPresetBuffs,
  type DiscBuffEvaluationContext,
  type PotentialExtraHitSpec,
  type PresetBuffRosterSlot,
} from './preset-buffs-core.ts';
import {
  hasActiveRotationEntries,
  toSlotRotationAbilities,
  type BuildRotation,
  type ParsedRotationSkillOption,
} from './build-rotation.ts';
import type { SynthesizedProfileSummary } from './combat-profile-synthesizer.ts';

export type FightMode = 'single' | 'multi';
export type BaselineDupePreset = 'c1-paid-c6-f2p' | 'all-c1' | 'all-c6';
export type BaselineContextMode = 'equipped' | 'isolated';
export type NotesMode = 'lv1-harmony' | 'target' | 'starting' | 'max-harmony';
export type UptimeMode = 'realistic' | 'ideal';
export type EnemyResPreset = 'boss-blitz' | 'neutral' | 'low';
export type CompareBaseline = 'empty' | 'slot-0' | 'slot-1' | 'slot-2';
export type PotentialLevelMode = 'preset' | 'lv6';
export type EmblemBaselineMode = 'none' | 'synthetic';
export type SkillLevelSource = 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate';

export interface DiscRankingAssumptions {
  fightMode: FightMode;
  baselineDupes: BaselineDupePreset;
  baselineContext: BaselineContextMode;
  notesMode: NotesMode;
  uptimeMode: UptimeMode;
  enemyRes: EnemyResPreset;
  compareBaseline: CompareBaseline;
  potentialLevelMode: PotentialLevelMode;
  emblemBaseline: EmblemBaselineMode;
}

export const DEFAULT_DISC_RANKING_ASSUMPTIONS: DiscRankingAssumptions = {
  fightMode: 'single',
  baselineDupes: 'c1-paid-c6-f2p',
  baselineContext: 'equipped',
  notesMode: 'lv1-harmony',
  uptimeMode: 'realistic',
  enemyRes: 'boss-blitz',
  compareBaseline: 'empty',
  potentialLevelMode: 'preset',
  emblemBaseline: 'none',
};

export interface SlotDamageSlice {
  type: DamageType;
  weight: number;
  skillSource?: SkillLevelSource;
}

export interface BuildCombatProfile {
  carrySlot: SlotKey;
  carryTypeStat: BuffStatKey;
  slots: Partial<Record<SlotKey, SlotDamageSlice[]>>;
  /** Preferred flex slot index (0..2) when swapping non-equipped Main/Support discs against an empty slot */
  flexMainIndex?: number;
  flexSupportIndex?: number;
}

export interface SlicedCombatStats {
  id: number;
  name: string;
  star: number;
  element: ElementType;
  class: string;
  scalingStat: ScalingStat;
  stats: CharacterCombatEntry['stats'];
  triggersMarkElements?: ElementType[];
  inflictsMarkElements?: ElementType[];
}

export interface DiscRankingRosterEntry {
  slot: SlotKey;
  character: SSCharacter | null;
  combat: SlicedCombatStats | null;
}

/**
 * Compact, JSON-serializable payload prepared on the server (`builds/[id]/page.tsx`)
 * so `/builds/[id]` can recalculate disc rankings live on the client without shipping
 * `potentials-db.json` (1.14 MB), `character-combat.json` (154 KB), or all 106 discs.
 */
export interface SlicedPotentialEntry {
  potentialId: number;
  slot: SlotKey;
  characterId: number;
  characterName: string;
  name: string;
  rarity: string;
  presetLevel: number;
  maxLevel: number;
  kind: 'stat' | 'hybrid' | 'proc' | 'mechanic';
  buffsAtPreset: TeamBuffInput[];
  buffsAtPresetPlus3: TeamBuffInput[];
  buffsAtLv6: TeamBuffInput[];
  buffsAtLv9: TeamBuffInput[];
  extraHitsAtPreset: PotentialExtraHitSpec[];
  extraHitsAtPresetPlus3: PotentialExtraHitSpec[];
  extraHitsAtLv6: PotentialExtraHitSpec[];
  extraHitsAtLv9: PotentialExtraHitSpec[];
}

export interface SkillLv3BuffPair {
  atLv10: TeamBuffInput[];
  atLv13: TeamBuffInput[];
}

export interface BaseSkillBuffInput extends TeamBuffInput {
  slot?: SlotKey;
  skillSource?: SkillLevelSource;
}

export interface DiscRankingContext {
  presetId: string;
  element: ElementType;
  archetype: string;
  mainDiscs: SelectedMainDisc[];
  supportDiscs: SelectedSupportDisc[];
  targetNotes: Partial<Record<NoteName, number>>;
  roster: DiscRankingRosterEntry[];
  basePotentialBuffs: TeamBuffInput[];
  corePotentialBuffs?: TeamBuffInput[];
  baseSkillBuffs?: BaseSkillBuffInput[];
  potentials?: SlicedPotentialEntry[];
  skillLv3Ratios?: Partial<Record<SlotKey, Partial<Record<SkillLevelSource, number>>>>;
  skillLv3BuffPairs?: Partial<Record<SlotKey, Partial<Record<SkillLevelSource, SkillLv3BuffPair>>>>;
  candidateDiscs: Record<string, SSDisc>;
  profile: BuildCombatProfile;
  profileSummary?: SynthesizedProfileSummary;
  combatRotation?: BuildRotation;
  parsedSkillsBySlot?: Partial<Record<SlotKey, ParsedRotationSkillOption[]>>;
}

export interface EstimatedDiscRankingsResult extends DiscRankingsData {
  baselineDiscName?: string;
  comparedSlotIndex?: number;
}

const GENERIC_SECONDARY_STAT_KEYS = new Set([
  'Skill DMG',
  'Auto Attack DMG',
  'Ultimate DMG',
]);

export const ENEMY_RES_BY_PRESET: Record<EnemyResPreset, number> = {
  'boss-blitz': 250,
  neutral: 750,
  low: 0,
};

export function hasGenericSecondaryStat(disc: SSDisc): boolean {
  const lv90 = disc.stats?.lv90;
  if (!lv90) return false;
  return Object.keys(lv90).some((k) => GENERIC_SECONDARY_STAT_KEYS.has(k));
}

const BLANK_MAIN_DISC_ID = -901;
const BLANK_SUPPORT_DISC_ID = -902;

/**
 * Synthetic off-element blank discs matching ZiLenTz's isolated sheet baselines:
 * - Main blank: Lv90 ATK 842 (no element/type stats, no Melody/Harmony buffs)
 * - Support blank: Lv90 C6 ATK 1,492 (842 + 650 dupeAtk, no element/type stats, no notes)
 */
const SYNTHETIC_BLANK_DISCS: Record<string, SSDisc> = {
  [String(BLANK_MAIN_DISC_ID)]: {
    id: BLANK_MAIN_DISC_ID,
    name: 'Off-Element (Atk 842)',
    star: 5,
    element: 'None',
    tag: [],
    char: [],
    stats: { lv1: { ATK: 0 }, lv80: { ATK: 750 }, lv90: { ATK: 842 } },
    dupeAtk: [0, 0, 0, 0, 0],
    supportNote: [],
  },
  [String(BLANK_SUPPORT_DISC_ID)]: {
    id: BLANK_SUPPORT_DISC_ID,
    name: 'Off-Element (Atk 1,492)',
    star: 5,
    element: 'None',
    tag: [],
    char: [],
    stats: { lv1: { ATK: 0 }, lv80: { ATK: 750 }, lv90: { ATK: 842 } },
    dupeAtk: [130, 260, 390, 520, 650],
    supportNote: [],
  },
};

export function detectScalingStat(combat: CharacterCombatEntry | null): ScalingStat {
  if (!combat) return 'ATK';
  const descs = [
    combat.skill?.desc,
    combat.normalAtk?.desc,
    combat.ultimate?.desc,
    combat.supportSkill?.desc,
  ]
    .filter(Boolean)
    .join('\n');
  if (/\bof\s+(?:Max\s+)?HP\b/i.test(descs)) return 'HP';
  if (/\bof\s+(?:Max\s+)?DEF\b/i.test(descs)) return 'DEF';
  return 'ATK';
}

/**
 * Server-side context builder: slices ONLY the build's 3 Trekkers, their pre-extracted
 * Potential buffs, and relevant candidate discs (~22-28 discs) for client execution.
 */
export function resolveBaselineCrescendo(
  presetCrescendo: number | undefined,
  disc: SSDisc | undefined,
  presetMode: BaselineDupePreset
): number {
  if (presetMode === 'all-c1') return 1;
  if (presetMode === 'all-c6') return 6;
  // c1-paid-c6-f2p: preserve preset's curated C1/C6 for equipped discs; 4★ and non-banner 5★ default C6
  if (presetCrescendo === 1 || presetCrescendo === 6) return presetCrescendo;
  if (!disc) return 1;
  if (disc.star < 5) return 6;
  return disc.char ? 1 : 6;
}

export function getEffectiveNotes(
  notesMode: NotesMode,
  supportDiscs: SelectedSupportDisc[],
  ctx: DiscRankingContext
): Partial<Record<NoteName, number>> {
  if (notesMode === 'starting') {
    return calculateSupportStartingNotes(supportDiscs, ctx.candidateDiscs) as Partial<
      Record<NoteName, number>
    >;
  }
  return ctx.targetNotes;
}

export function buildFighters(ctx: DiscRankingContext): FighterInput[] {
  const useCustomRotation = hasActiveRotationEntries(ctx.combatRotation);
  return ctx.roster.map((entry) => {
    const slices = ctx.profile.slots[entry.slot] || [];
    const scalingStat: ScalingStat = entry.combat?.scalingStat ?? 'ATK';
    // HP pools (~95k) are ~6x larger than total Base ATK (~16k) while in-game HP MVs are ~6x smaller;
    // normalize HP-scaler weights so profile weights map consistently to team damage share.
    const statScaleNorm = scalingStat === 'HP' ? 0.16 : 1;
    const rotation: RotationAbility[] = useCustomRotation
      ? toSlotRotationAbilities(ctx.combatRotation!, entry.slot)
      : slices.map((s, idx) => {
          const resolvedSource: RotationAbility['source'] =
            s.skillSource ??
            (s.type === 'Skill'
              ? entry.slot === 'vanguard'
                ? 'skill'
                : 'supportSkill'
              : s.type === 'Ultimate'
                ? 'ultimate'
                : s.type === 'Auto Attack'
                  ? entry.slot === 'vanguard'
                    ? 'normalAtk'
                    : 'supportSkill'
                  : s.type === 'Mark' && entry.slot !== 'vanguard'
                    ? 'supportSkill'
                    : 'custom');
          return {
            id: `${entry.slot}-${idx}`,
            source: resolvedSource,
            name: s.type,
            scalingStat,
            damageType: s.type,
            motionValuePct: +(s.weight * statScaleNorm).toFixed(2),
            hits: 1,
            casts: 1,
          };
        });

    return {
      state: {
        slot: entry.slot,
        level: '90',
        skillLevel: 10,
        affinityLevel: 30,
        talentTier: entry.character?.star === 4 ? 5 : 0,
        emblems: { 70: [], 80: [], 90: [] },
        rotation,
      },
      character: entry.character,
      combat: entry.combat as CharacterCombatEntry | null,
    };
  });
}

export interface EvaluateTeamLoadoutOptions {
  potentialBuffs?: TeamBuffInput[];
  extraRotations?: Partial<Record<SlotKey, RotationAbility[]>>;
  includeSyntheticEmblems?: boolean;
  extraBuffs?: TeamBuffInput[];
  skillLv3Scale?: { slot: SlotKey; skillSource: SkillLevelSource; ratio: number };
  skillLv3BuffOverride?: { slot: SlotKey; skillSource: SkillLevelSource; buffs: TeamBuffInput[] };
  talentTierOverrides?: Partial<Record<SlotKey, number>>;
}

export function evaluateTeamLoadout(
  ctx: DiscRankingContext,
  discsLookup: Record<string, SSDisc>,
  fighters: FighterInput[],
  presetRoster: PresetBuffRosterSlot[],
  mainDiscs: SelectedMainDisc[],
  supportDiscs: SelectedSupportDisc[],
  assumptions: DiscRankingAssumptions,
  options?: EvaluateTeamLoadoutOptions
): TeamCalcResult {
  const effectiveNotes = getEffectiveNotes(assumptions.notesMode, supportDiscs, ctx);
  const contributions = computePresetContributions(
    mainDiscs,
    supportDiscs,
    effectiveNotes,
    discsLookup
  );

  const evalContext: DiscBuffEvaluationContext = {
    enforceTriggers: true,
    fightMode: assumptions.fightMode,
    uptimeMode: assumptions.uptimeMode,
    destinyCards: assumptions.notesMode === 'starting' ? 0 : 10,
    forceHarmonyLevel:
      assumptions.notesMode === 'lv1-harmony'
        ? 1
        : assumptions.notesMode === 'max-harmony'
          ? 5
          : undefined,
  };

  const discBuffs = extractDiscPresetBuffs(
    mainDiscs,
    effectiveNotes,
    discsLookup,
    presetRoster,
    undefined,
    evalContext
  );

  const carryScaling =
    ctx.roster.find((r) => r.slot === ctx.profile.carrySlot)?.combat?.scalingStat ?? 'ATK';
  const carryPrimaryStat: BuffStatKey =
    carryScaling === 'HP' ? 'hpPct' : carryScaling === 'DEF' ? 'defPct' : 'atkPctPerma';

  const includeSynthetic =
    options?.includeSyntheticEmblems ?? assumptions.emblemBaseline === 'synthetic';
  const syntheticBuffs: TeamBuffInput[] = [];
  if (includeSynthetic) {
    const SLOTS: SlotKey[] = ['vanguard', 'versatile', 'support'];
    const TYPE_TO_STAT: Record<DamageType, BuffStatKey> = {
      Skill: 'skillDmg',
      Ultimate: 'ultDmg',
      'Auto Attack': 'aaDmg',
      Mark: 'markDmg',
      Minion: 'minionDmg',
    };

    // Only grant synthetic +110 PEN on slots whose fixed baseline kit has < 90 PEN
    for (const slot of SLOTS) {
      let kitPen = 0;
      for (const b of [...ctx.basePotentialBuffs, ...(ctx.baseSkillBuffs ?? [])]) {
        if (b.stat === 'resPen' && (b.target === 'team' || b.target === slot)) {
          kitPen += b.value;
        }
      }
      if (kitPen < 90) {
        syntheticBuffs.push({ target: slot, stat: 'resPen', value: 110 });
      }
    }

    // Standard 3x generic offensive emblem baseline for main carry
    syntheticBuffs.push(
      { target: ctx.profile.carrySlot, stat: carryPrimaryStat, value: 36 },
      { target: ctx.profile.carrySlot, stat: 'elementDmg', value: 45 },
      { target: ctx.profile.carrySlot, stat: ctx.profile.carryTypeStat, value: 55 }
    );

    // Light proportional synthetic emblem baseline for meaningful sub-DPS slots
    const totalProfileWeight = SLOTS.reduce(
      (sum, s) => sum + (ctx.profile.slots[s] ?? []).reduce((a, sl) => a + sl.weight, 0),
      0
    );
    for (const slot of SLOTS) {
      if (slot === ctx.profile.carrySlot) continue;
      const slotSlices = ctx.profile.slots[slot] ?? [];
      const totalWeight = slotSlices.reduce((sum, s) => sum + s.weight, 0);
      if (totalProfileWeight <= 0 || totalWeight / totalProfileWeight < 0.12) continue;
      const slotScaling = ctx.roster.find((r) => r.slot === slot)?.combat?.scalingStat ?? 'ATK';
      const slotPrimaryStat: BuffStatKey =
        slotScaling === 'HP' ? 'hpPct' : slotScaling === 'DEF' ? 'defPct' : 'atkPctPerma';
      let topSlice = slotSlices[0];
      for (const s of slotSlices) {
        if (s.weight > topSlice.weight) topSlice = s;
      }
      syntheticBuffs.push(
        { target: slot, stat: slotPrimaryStat, value: 12 },
        { target: slot, stat: 'elementDmg', value: 24 },
        { target: slot, stat: TYPE_TO_STAT[topSlice.type], value: 20 }
      );
    }
  }

  const isRealisticUptime = assumptions.uptimeMode === 'realistic';
  const scalePotentialBuff = (b: TeamBuffInput): TeamBuffInput =>
    isRealisticUptime && b.realisticUptime !== undefined && b.realisticUptime !== 1
      ? { target: b.target, stat: b.stat, value: +(b.value * b.realisticUptime).toFixed(4) }
      : { target: b.target, stat: b.stat, value: b.value };

  const overrideSkill = options?.skillLv3BuffOverride;
  const activeBaseSkillBuffs = (ctx.baseSkillBuffs ?? [])
    .filter(
      (b) =>
        !overrideSkill ||
        b.slot !== overrideSkill.slot ||
        b.skillSource !== overrideSkill.skillSource
    )
    .map(scalePotentialBuff);
  const replacedSkillBuffs = (overrideSkill?.buffs ?? []).map(scalePotentialBuff);

  const buffs: TeamBuffInput[] = [
    ...(options?.potentialBuffs ?? ctx.basePotentialBuffs).map(scalePotentialBuff),
    ...activeBaseSkillBuffs,
    ...replacedSkillBuffs,
    ...discBuffs.map((b) => ({ target: b.target, stat: b.stat, value: b.value })),
    ...syntheticBuffs,
    ...(options?.extraBuffs ?? []).map(scalePotentialBuff),
  ];

  const effectiveFighters: FighterInput[] =
    options?.extraRotations || options?.skillLv3Scale || options?.talentTierOverrides
      ? fighters.map((f) => {
          const slot = f.state.slot;
          const extra = options?.extraRotations?.[slot] ?? [];
          const lv3 = options?.skillLv3Scale;
          const overrideTier = options?.talentTierOverrides?.[slot];
          const scaledBase =
            lv3 && lv3.slot === slot
              ? f.state.rotation.map((ab) =>
                  ab.source === lv3.skillSource
                    ? { ...ab, motionValuePct: +(ab.motionValuePct * lv3.ratio).toFixed(4) }
                    : ab
                )
              : f.state.rotation;
          const rotation = extra.length > 0 ? [...scaledBase, ...extra] : scaledBase;
          if (rotation === f.state.rotation && overrideTier === undefined) return f;
          return {
            ...f,
            state: {
              ...f.state,
              ...(overrideTier !== undefined ? { talentTier: overrideTier } : {}),
              rotation,
            },
          };
        })
      : fighters;

  return calculateTeam({
    fighters: effectiveFighters,
    contributions,
    buffs,
    recordLevel: 31,
    uptimeMode: assumptions.uptimeMode,
    enemy: {
      def: 500,
      res: ENEMY_RES_BY_PRESET[assumptions.enemyRes],
      resilienceBroken: false,
      resilienceBreakUptimePct: 27.7778,
    },
  });
}

function evaluateLoadoutDamage(
  ctx: DiscRankingContext,
  discsLookup: Record<string, SSDisc>,
  fighters: FighterInput[],
  presetRoster: PresetBuffRosterSlot[],
  mainDiscs: SelectedMainDisc[],
  supportDiscs: SelectedSupportDisc[],
  assumptions: DiscRankingAssumptions
): number {
  return evaluateTeamLoadout(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    mainDiscs,
    supportDiscs,
    assumptions
  ).totalExpected;
}

function parseSlotIndex(compareBaseline: CompareBaseline): number | null {
  if (compareBaseline === 'slot-0') return 0;
  if (compareBaseline === 'slot-1') return 1;
  if (compareBaseline === 'slot-2') return 2;
  return null;
}

/**
 * Pure disc ranking calculator — computes Main & Support Disc relative damage increases
 * (`Dmg Inc %` vs `1 Empty Slot = 0%`, or net `+/- %` vs replacing an equipped disc slot).
 */
export function computeEstimatedDiscRankings(
  ctx: DiscRankingContext,
  partialAssumptions?: Partial<DiscRankingAssumptions>
): EstimatedDiscRankingsResult {
  const assumptions: DiscRankingAssumptions = {
    ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
    ...partialAssumptions,
  };

  const fighters = buildFighters(ctx);
  const presetRoster: PresetBuffRosterSlot[] = ctx.roster.map((r) => ({
    slot: r.slot,
    character: r.character,
  }));

  const baseMain: SelectedMainDisc[] = ctx.mainDiscs.map((m) => ({
    ...m,
    level: 90,
    crescendo: resolveBaselineCrescendo(
      m.crescendo,
      m.discId ? ctx.candidateDiscs[String(m.discId)] : undefined,
      assumptions.baselineDupes
    ),
  }));

  const baseSupport: SelectedSupportDisc[] = ctx.supportDiscs.map((s) => ({
    ...s,
    level: 90,
    crescendo: resolveBaselineCrescendo(
      s.crescendo,
      s.discId ? ctx.candidateDiscs[String(s.discId)] : undefined,
      assumptions.baselineDupes
    ),
  }));

  const discsLookup: Record<string, SSDisc> = {
    ...ctx.candidateDiscs,
    ...SYNTHETIC_BLANK_DISCS,
  };

  const compareSlotIdx = parseSlotIndex(assumptions.compareBaseline);
  const isIsolated = compareSlotIdx === null && assumptions.baselineContext === 'isolated';
  const flexMainIdx = Math.min(ctx.profile.flexMainIndex ?? 2, Math.max(0, baseMain.length - 1));
  const flexSupportIdx = Math.min(
    ctx.profile.flexSupportIndex ?? 2,
    Math.max(0, baseSupport.length - 1)
  );

  // Isolated sheet baselines:
  // Main: 1 Empty Slot + 2x Off-Element Discs (Atk 842) | Support: build's 3 Support Discs
  // Support: build's 3 Equipped Main Discs | Support: 1 Empty Slot + 2x Off-Element C6 Discs (Atk 1,492)
  const isolatedMainFill: SelectedMainDisc[] = [
    { discId: null, level: 90, crescendo: 1 },
    { discId: BLANK_MAIN_DISC_ID, level: 90, crescendo: 1 },
    { discId: BLANK_MAIN_DISC_ID, level: 90, crescendo: 1 },
  ];
  const isolatedSupportFill: SelectedSupportDisc[] = [
    { discId: null, level: 90, crescendo: 1, phase: 8 },
    { discId: BLANK_SUPPORT_DISC_ID, level: 90, crescendo: 6, phase: 8 },
    { discId: BLANK_SUPPORT_DISC_ID, level: 90, crescendo: 6, phase: 8 },
  ];

  // Precompute baseline & empty reference damages
  const fullBaselineDmg = evaluateLoadoutDamage(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    baseMain,
    baseSupport,
    assumptions
  );

  const isolatedEmptyMainDmg = isIsolated
    ? evaluateLoadoutDamage(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        isolatedMainFill,
        baseSupport,
        assumptions
      )
    : 0;

  const isolatedEmptySupportDmg = isIsolated
    ? evaluateLoadoutDamage(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        isolatedSupportFill,
        assumptions
      )
    : 0;

  const emptyMainDmgBySlot = isIsolated
    ? []
    : baseMain.map((_, idx) => {
        const stripped = baseMain.map((m, i) =>
          i === idx ? { discId: null, level: 90 as const, crescendo: 1 } : m
        );
        return evaluateLoadoutDamage(
          ctx,
          discsLookup,
          fighters,
          presetRoster,
          stripped,
          baseSupport,
          assumptions
        );
      });

  const emptySupportDmgBySlot = isIsolated
    ? []
    : baseSupport.map((_, idx) => {
        const stripped = baseSupport.map((s, i) =>
          i === idx ? { discId: null, level: 90 as const, crescendo: 1, phase: 8 } : s
        );
        return evaluateLoadoutDamage(
          ctx,
          discsLookup,
          fighters,
          presetRoster,
          baseMain,
          stripped,
          assumptions
        );
      });

  const equippedMainIdxById = new Map<number, number>();
  baseMain.forEach((m, idx) => {
    if (m.discId) equippedMainIdxById.set(m.discId, idx);
  });

  const equippedSupportIdxById = new Map<number, number>();
  baseSupport.forEach((s, idx) => {
    if (s.discId) equippedSupportIdxById.set(s.discId, idx);
  });

  const allCandidates = Object.values(ctx.candidateDiscs);

  // ---- MAIN DISC RANKINGS ----
  const mainRows: DiscRankRow[] = [];
  const mainCandidates = allCandidates.filter(
    (d) => (d.element === ctx.element && d.star >= 4) || equippedMainIdxById.has(d.id)
  );

  for (const disc of mainCandidates) {
    const equippedIdx = equippedMainIdxById.get(disc.id);

    // When comparing against replacing a specific slot, skip discs already locked in the other 2 Main slots
    if (compareSlotIdx !== null && equippedIdx !== undefined && equippedIdx !== compareSlotIdx) {
      continue;
    }

    const targetSlotIdx =
      compareSlotIdx !== null
        ? compareSlotIdx
        : equippedIdx !== undefined
          ? equippedIdx
          : flexMainIdx;

    const refDmg =
      compareSlotIdx !== null
        ? fullBaselineDmg
        : isIsolated
          ? isolatedEmptyMainDmg
          : emptyMainDmgBySlot[targetSlotIdx];
    const dupes: Array<1 | 6> = disc.star === 5 ? [6, 1] : [6];

    for (const c of dupes) {
      const swappedMain = isIsolated
        ? [
            { discId: disc.id, level: 90 as const, crescendo: c },
            isolatedMainFill[1],
            isolatedMainFill[2],
          ]
        : baseMain.map((m, i) =>
            i === targetSlotIdx ? { discId: disc.id, level: 90 as const, crescendo: c } : m
          );
      const dmg = evaluateLoadoutDamage(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        swappedMain,
        baseSupport,
        assumptions
      );
      const pct = refDmg > 0 ? +(((dmg - refDmg) / refDmg) * 100).toFixed(2) : 0;
      const isBaseline =
        equippedIdx !== undefined && baseMain[equippedIdx].crescendo === c;

      mainRows.push({
        name: disc.name,
        discId: disc.id,
        dupe: c === 6 ? 'C6' : 'C1',
        value: pct,
        ...(isBaseline ? { isBaseline: true } : {}),
      });
    }
  }

  mainRows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  // ---- SUPPORT DISC RANKINGS ----
  const supportRows: DiscRankRow[] = [];
  const supportCandidates = allCandidates.filter(
    (d) =>
      !equippedMainIdxById.has(d.id) &&
      ((d.element === ctx.element && d.star === 5) ||
        (d.star === 5 && hasGenericSecondaryStat(d)) ||
        equippedSupportIdxById.has(d.id))
  );

  for (const disc of supportCandidates) {
    const equippedIdx = equippedSupportIdxById.get(disc.id);

    if (
      compareSlotIdx !== null &&
      equippedIdx !== undefined &&
      equippedIdx !== compareSlotIdx
    ) {
      continue;
    }

    const targetSlotIdx =
      compareSlotIdx !== null
        ? compareSlotIdx
        : equippedIdx !== undefined
          ? equippedIdx
          : flexSupportIdx;

    const refDmg =
      compareSlotIdx !== null
        ? fullBaselineDmg
        : isIsolated
          ? isolatedEmptySupportDmg
          : emptySupportDmgBySlot[targetSlotIdx];
    const dupes: Array<1 | 6> = disc.star === 5 ? [6, 1] : [6];

    for (const c of dupes) {
      const swappedSupport = isIsolated
        ? [
            { discId: disc.id, level: 90 as const, crescendo: c, phase: 8 },
            isolatedSupportFill[1],
            isolatedSupportFill[2],
          ]
        : baseSupport.map((s, i) =>
            i === targetSlotIdx
              ? { discId: disc.id, level: 90 as const, crescendo: c, phase: 8 }
              : s
          );
      const dmg = evaluateLoadoutDamage(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        swappedSupport,
        assumptions
      );
      const pct = refDmg > 0 ? +(((dmg - refDmg) / refDmg) * 100).toFixed(2) : 0;
      const isBaseline =
        equippedIdx !== undefined && (baseSupport[equippedIdx].crescendo ?? 1) === c;

      supportRows.push({
        name: disc.name,
        discId: disc.id,
        dupe: c === 6 ? 'C6' : 'C1',
        value: pct,
        ...(isBaseline ? { isBaseline: true } : {}),
      });
    }
  }

  // Add synthetic Off-Element C6 (ATK 1,492) benchmark row in Empty Slot mode
  if (compareSlotIdx === null) {
    const offElRefDmg = isIsolated
      ? isolatedEmptySupportDmg
      : emptySupportDmgBySlot[flexSupportIdx];
    const offElSupport = isIsolated
      ? [
          { discId: BLANK_SUPPORT_DISC_ID, level: 90 as const, crescendo: 6, phase: 8 },
          isolatedSupportFill[1],
          isolatedSupportFill[2],
        ]
      : baseSupport.map((s, i) =>
          i === flexSupportIdx
            ? { discId: BLANK_SUPPORT_DISC_ID, level: 90 as const, crescendo: 6, phase: 8 }
            : s
        );
    const offElDmg = evaluateLoadoutDamage(
      ctx,
      discsLookup,
      fighters,
      presetRoster,
      baseMain,
      offElSupport,
      assumptions
    );
    const offElPct =
      offElRefDmg > 0 ? +(((offElDmg - offElRefDmg) / offElRefDmg) * 100).toFixed(2) : 0;
    supportRows.push({ name: 'Off-Element (Atk 1,492)', dupe: 'C6', value: offElPct });
  }

  supportRows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  if (compareSlotIdx === null) {
    supportRows.push({ name: '1 Empty Slot', dupe: 'C1', value: 0 });
  }

  const baselineDiscId =
    compareSlotIdx !== null ? baseMain[compareSlotIdx]?.discId : undefined;
  const baselineDiscName = baselineDiscId
    ? ctx.candidateDiscs[String(baselineDiscId)]?.name
    : undefined;

  return {
    metricLabel: compareSlotIdx !== null ? 'vs Equipped' : 'Dmg Inc',
    main: mainRows,
    support: supportRows,
    ...(baselineDiscName ? { baselineDiscName } : {}),
    ...(compareSlotIdx !== null ? { comparedSlotIndex: compareSlotIdx } : {}),
  };
}
