import type { SSDisc, SelectedMainDisc, SelectedSupportDisc } from '../../types/index.ts';
import type {
  HeatmapPalette,
  SkillHighlightTone,
  SkillPlus3Cell,
  SkillPlus3Row,
  SkillPlus3Variant,
  TalentTierRow,
  TalentTrekkerTable,
} from '../community-analytics-utils.ts';
import type { BuffStatKey, DamageType, ScalingStat } from './damage-engine.ts';
import { getEmblemValue } from './talent-emblem.ts';
import type {
  FighterInput,
  RotationAbility,
  SlotKey,
  TeamBuffInput,
  TeamCalcResult,
} from './fighter-calc.ts';
import type { PotentialExtraHitSpec, PresetBuffRosterSlot } from './preset-buffs-core.ts';
import {
  buildFighters,
  evaluateTeamLoadout,
  resolveBaselineCrescendo,
  type DiscRankingAssumptions,
  type DiscRankingContext,
  type SkillLevelSource,
  type SlicedPotentialEntry,
} from './disc-rankings-client.ts';

export interface EstimatedPotRankRow {
  potentialId: number;
  name: string;
  slot: SlotKey;
  characterId: number;
  characterName: string;
  baseLevel: number;
  value: number | null;
  kind: SlicedPotentialEntry['kind'];
}

export interface EstimatedPotPlus3Row {
  potentialId: number;
  name: string;
  slot: SlotKey;
  characterId: number;
  characterName: string;
  baseLevel: number;
  upgradedLevel: number;
  teamDmg: number | null;
  personalDmg: number | null;
  kind: SlicedPotentialEntry['kind'];
  isRecommended: boolean;
}

export interface EstimatedPotentialRankingsResult {
  potRank: EstimatedPotRankRow[];
  potPlus3: EstimatedPotPlus3Row[];
}

export interface EstimatedEmblemStatRow {
  stat: string;
  dmgGain: number;
  isRecommended: boolean;
}

export interface EstimatedEmblemColumn {
  slot: SlotKey;
  trekkerId: number;
  label: string;
  palette: HeatmapPalette;
  dpsSharePct: number;
  rows: EstimatedEmblemStatRow[];
}

function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

function clamp(min: number, max: number, val: number): number {
  return Math.max(min, Math.min(max, val));
}

function effectiveExtraHitMv(s: PotentialExtraHitSpec): number {
  return s.mvPct * (1 + ((s.perStackBonusPct ?? 0) * 10) / 100);
}

function sumExtraHitNormMv(specs: PotentialExtraHitSpec[], hpNorm: number): number {
  let sum = 0;
  for (const s of specs) {
    const norm = s.scalingStat === 'HP' ? hpNorm : 1;
    sum += effectiveExtraHitMv(s) * s.hits * norm;
  }
  return sum;
}

function buildExtraHitSlicesForPotential(
  p: SlicedPotentialEntry,
  specs: PotentialExtraHitSpec[],
  ownerUnnormalizedWeight: number,
  totalTeamWeight: number
): RotationAbility[] {
  if (specs.length === 0 || ownerUnnormalizedWeight <= 0 || totalTeamWeight <= 0) return [];

  const hpNorm = p.kind === 'proc' ? 0.16 : 1 / 0.16;
  const lv6Norm = sumExtraHitNormMv(p.extraHitsAtLv6, hpNorm);
  const specNorm = sumExtraHitNormMv(specs, hpNorm);
  if (specNorm <= 0) return [];

  const shortIcdSpec = specs.find(
    (s) => s.isMarkReaction && s.icdSec !== undefined && s.icdSec <= 2.5
  );
  const isShortIcdMarkReaction = shortIcdSpec !== undefined;
  const effectiveAnchorWeight = isShortIcdMarkReaction
    ? Math.max(ownerUnnormalizedWeight, totalTeamWeight)
    : ownerUnnormalizedWeight;

  const refNorm = lv6Norm > 0 ? lv6Norm : specNorm;
  const ownerShare = ownerUnnormalizedWeight / totalTeamWeight;
  const supportBoost =
    p.kind === 'hybrid' && ownerShare < 0.12
      ? Math.min(24, 0.72 / Math.max(0.015, ownerShare))
      : 1;
  // Smooth continuous taper from sub-DPS shares (<= 48%) down to hypercarry shares (>= 56%)
  const carryRamp = clamp(0, 1, (ownerShare - 0.48) / 0.08);
  const hybridCap = 0.315 - 0.175 * carryRamp;
  const lv6Share = isShortIcdMarkReaction
    ? clamp(0.25, 1.15, (refNorm * (12 / Math.max(1, shortIcdSpec.icdSec!))) / 6500)
    : p.kind === 'proc'
      ? clamp(0.035, 0.25, refNorm / 2400)
      : refNorm < 350
        ? clamp(0.035, 0.048, refNorm / 6500)
        : clamp(0.08, hybridCap, refNorm / 430) * supportBoost;

  const scaledShare = lv6Share * (specNorm / refNorm);

  return specs.map((spec, idx) => {
    const partNorm = effectiveExtraHitMv(spec) * spec.hits * (spec.scalingStat === 'HP' ? hpNorm : 1);
    const partFrac = partNorm / specNorm;
    const statScaleNorm = spec.scalingStat === 'HP' ? 0.16 : 1;
    const mv = effectiveAnchorWeight * scaledShare * partFrac * statScaleNorm;
    return {
      id: `pot-proc-${p.potentialId}-${idx}`,
      source: 'custom',
      name: `${p.name} Proc`,
      scalingStat: spec.scalingStat,
      damageType: spec.damageType,
      motionValuePct: +mv.toFixed(4),
      hits: 1,
      casts: 1,
    };
  });
}

function prepareLoadoutInputs(ctx: DiscRankingContext, assumptions: DiscRankingAssumptions) {
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
  const discsLookup: Record<string, SSDisc> = { ...ctx.candidateDiscs };
  return { fighters, presetRoster, baseMain, baseSupport, discsLookup };
}

function collectActivePotentialState(
  ctx: DiscRankingContext,
  assumptions: DiscRankingAssumptions
) {
  const potentials = ctx.potentials ?? [];
  const coreBuffs = ctx.corePotentialBuffs ?? [];
  const isLv6 = assumptions.potentialLevelMode === 'lv6';

  const ownerWeightBySlot: Record<SlotKey, number> = {
    vanguard: (ctx.profile.slots.vanguard ?? []).reduce((a, b) => a + b.weight, 0),
    versatile: (ctx.profile.slots.versatile ?? []).reduce((a, b) => a + b.weight, 0),
    support: (ctx.profile.slots.support ?? []).reduce((a, b) => a + b.weight, 0),
  };
  const totalTeamWeight =
    ownerWeightBySlot.vanguard + ownerWeightBySlot.versatile + ownerWeightBySlot.support;

  const entries = potentials.map((p) => {
    const baseLevel = isLv6 ? Math.min(p.maxLevel, 6) : p.presetLevel;
    const upgradedLevel = Math.min(p.maxLevel, baseLevel + 3);
    const baseBuffs = isLv6 ? p.buffsAtLv6 : p.buffsAtPreset;
    const plus3Buffs = isLv6 ? p.buffsAtLv9 : p.buffsAtPresetPlus3;
    const baseHitSpecs = isLv6 ? p.extraHitsAtLv6 : p.extraHitsAtPreset;
    const plus3HitSpecs = isLv6 ? p.extraHitsAtLv9 : p.extraHitsAtPresetPlus3;
    const weight = ownerWeightBySlot[p.slot] || 0;

    return {
      entry: p,
      baseLevel,
      upgradedLevel,
      baseBuffs,
      plus3Buffs,
      baseSlices: buildExtraHitSlicesForPotential(p, baseHitSpecs, weight, totalTeamWeight),
      plus3Slices: buildExtraHitSlicesForPotential(p, plus3HitSpecs, weight, totalTeamWeight),
    };
  });

  return { coreBuffs, entries };
}

function buildExtraRotationsMap(
  slicesByPot: Array<{ slot: SlotKey; slices: RotationAbility[] }>
): Partial<Record<SlotKey, RotationAbility[]>> {
  const map: Partial<Record<SlotKey, RotationAbility[]>> = {};
  for (const item of slicesByPot) {
    if (item.slices.length === 0) continue;
    if (!map[item.slot]) map[item.slot] = [];
    map[item.slot]!.push(...item.slices);
  }
  return map;
}

export function computeEstimatedPotentialRankings(
  ctx: DiscRankingContext,
  assumptions: DiscRankingAssumptions
): EstimatedPotentialRankingsResult {
  const { fighters, presetRoster, baseMain, baseSupport, discsLookup } = prepareLoadoutInputs(
    ctx,
    assumptions
  );
  const { coreBuffs, entries } = collectActivePotentialState(ctx, assumptions);

  if (entries.length === 0) {
    return { potRank: [], potPlus3: [] };
  }

  const allBaseBuffs: TeamBuffInput[] = [
    ...coreBuffs,
    ...entries.flatMap((e) => e.baseBuffs),
  ];
  const allBaseRotations = buildExtraRotationsMap(
    entries.map((e) => ({ slot: e.entry.slot, slices: e.baseSlices }))
  );

  const baseResult = evaluateTeamLoadout(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    baseMain,
    baseSupport,
    assumptions,
    {
      potentialBuffs: allBaseBuffs,
      extraRotations: allBaseRotations,
    }
  );

  const baseOwnerExpected: Record<SlotKey, number> = {
    vanguard: baseResult.fighters.find((f) => f.state.slot === 'vanguard')?.totals.expected ?? 0,
    versatile: baseResult.fighters.find((f) => f.state.slot === 'versatile')?.totals.expected ?? 0,
    support: baseResult.fighters.find((f) => f.state.slot === 'support')?.totals.expected ?? 0,
  };

  const dpsSlots = new Set<SlotKey>([ctx.profile.carrySlot]);
  for (const f of baseResult.fighters) {
    if (baseResult.totalExpected > 0 && f.totals.expected / baseResult.totalExpected >= 0.05) {
      dpsSlots.add(f.state.slot);
    }
  }

  const potRank: EstimatedPotRankRow[] = [];
  const potPlus3: EstimatedPotPlus3Row[] = [];

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const p = item.entry;

    if (p.kind === 'mechanic') {
      potRank.push({
        potentialId: p.potentialId,
        name: p.name,
        slot: p.slot,
        characterId: p.characterId,
        characterName: p.characterName,
        baseLevel: item.baseLevel,
        value: null,
        kind: p.kind,
      });
      potPlus3.push({
        potentialId: p.potentialId,
        name: p.name,
        slot: p.slot,
        characterId: p.characterId,
        characterName: p.characterName,
        baseLevel: item.baseLevel,
        upgradedLevel: item.upgradedLevel,
        teamDmg: null,
        personalDmg: null,
        kind: p.kind,
        isRecommended: false,
      });
      continue;
    }

    // Pot Rank: value of having this potential vs removing it
    const withoutBuffs: TeamBuffInput[] = [
      ...coreBuffs,
      ...entries.flatMap((e, j) => (j === i ? [] : e.baseBuffs)),
    ];
    const withoutRotations = buildExtraRotationsMap(
      entries.map((e, j) => ({ slot: e.entry.slot, slices: j === i ? [] : e.baseSlices }))
    );
    const withoutResult = evaluateTeamLoadout(
      ctx,
      discsLookup,
      fighters,
      presetRoster,
      baseMain,
      baseSupport,
      assumptions,
      {
        potentialBuffs: withoutBuffs,
        extraRotations: withoutRotations,
      }
    );

    const rankPct =
      withoutResult.totalExpected > 0
        ? round2(
            ((baseResult.totalExpected - withoutResult.totalExpected) /
              withoutResult.totalExpected) *
              100
          )
        : 0;

    potRank.push({
      potentialId: p.potentialId,
      name: p.name,
      slot: p.slot,
      characterId: p.characterId,
      characterName: p.characterName,
      baseLevel: item.baseLevel,
      value: rankPct,
      kind: p.kind,
    });

    // Pot Lv +3: gain from upgrading this potential from baseLevel -> upgradedLevel
    const plus3Buffs: TeamBuffInput[] = [
      ...coreBuffs,
      ...entries.flatMap((e, j) => (j === i ? e.plus3Buffs : e.baseBuffs)),
    ];
    const plus3Rotations = buildExtraRotationsMap(
      entries.map((e, j) => ({
        slot: e.entry.slot,
        slices: j === i ? e.plus3Slices : e.baseSlices,
      }))
    );
    const plus3Result = evaluateTeamLoadout(
      ctx,
      discsLookup,
      fighters,
      presetRoster,
      baseMain,
      baseSupport,
      assumptions,
      {
        potentialBuffs: plus3Buffs,
        extraRotations: plus3Rotations,
      }
    );

    const teamGain =
      baseResult.totalExpected > 0
        ? round2(
            ((plus3Result.totalExpected - baseResult.totalExpected) / baseResult.totalExpected) *
              100
          )
        : 0;

    let personalGain: number | null = null;
    if (dpsSlots.has(p.slot)) {
      const ownerBase = baseOwnerExpected[p.slot];
      const ownerAfter =
        plus3Result.fighters.find((f) => f.state.slot === p.slot)?.totals.expected ?? 0;
      personalGain = ownerBase > 0 ? round2(((ownerAfter - ownerBase) / ownerBase) * 100) : 0;
    }

    potPlus3.push({
      potentialId: p.potentialId,
      name: p.name,
      slot: p.slot,
      characterId: p.characterId,
      characterName: p.characterName,
      baseLevel: item.baseLevel,
      upgradedLevel: item.upgradedLevel,
      teamDmg: teamGain,
      personalDmg: personalGain,
      kind: p.kind,
      isRecommended: false,
    });
  }

  potRank.sort((a, b) => {
    if (a.value === null && b.value === null) return a.name.localeCompare(b.name);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value || a.name.localeCompare(b.name);
  });

  potPlus3.sort((a, b) => {
    if (a.teamDmg === null && b.teamDmg === null) return a.name.localeCompare(b.name);
    if (a.teamDmg === null) return 1;
    if (b.teamDmg === null) return -1;
    return b.teamDmg - a.teamDmg || a.name.localeCompare(b.name);
  });

  let recCount = 0;
  for (const row of potPlus3) {
    if (row.kind !== 'mechanic' && row.teamDmg !== null && row.teamDmg > 0) {
      row.isRecommended = true;
      recCount++;
      if (recCount >= 5) break;
    }
  }

  return { potRank, potPlus3 };
}

const SKILL_LV3_LABEL: Record<SkillLevelSource, string> = {
  skill: 'Main Skill +3',
  supportSkill: 'Support Skill +3',
  ultimate: 'Ultimate +3',
  normalAtk: 'Auto Attack +3',
};

const TYPE_EMBLEM_SPECS: Record<
  DamageType,
  Array<{ label: string; stat: BuffStatKey; emblemKey: string; rarity: 'Rainbow' | 'Yellow' }>
> = {
  Skill: [
    { label: '20% Skill DMG', stat: 'skillDmg', emblemKey: 'Skill', rarity: 'Rainbow' },
    { label: '7.5% Skill Crit', stat: 'skillCritRate', emblemKey: 'Skill Crit rate%', rarity: 'Yellow' },
  ],
  Ultimate: [
    { label: '30% Ult DMG', stat: 'ultDmg', emblemKey: 'Ult', rarity: 'Rainbow' },
    { label: '7.5% Ult Crit', stat: 'ultCritRate', emblemKey: 'Ult Crit rate%', rarity: 'Yellow' },
  ],
  'Auto Attack': [
    { label: '30% AA DMG', stat: 'aaDmg', emblemKey: 'AA', rarity: 'Rainbow' },
    { label: '7.5% AA Crit', stat: 'aaCritRate', emblemKey: 'AA Crit rate%', rarity: 'Yellow' },
  ],
  Mark: [
    { label: '80% Mark DMG', stat: 'markDmg', emblemKey: 'Mark', rarity: 'Rainbow' },
    { label: '7.5% Mark Crit', stat: 'markCritRate', emblemKey: 'Mark Crit rate%', rarity: 'Yellow' },
  ],
  Minion: [
    { label: '20% Minion DMG', stat: 'minionDmg', emblemKey: 'Minion', rarity: 'Rainbow' },
    { label: '7.5% Minion Crit', stat: 'minionCritRate', emblemKey: 'Minion Crit rate%', rarity: 'Yellow' },
  ],
};

function evaluateSlotSkillPlus3(
  ctx: DiscRankingContext,
  discsLookup: Record<string, SSDisc>,
  fighters: FighterInput[],
  presetRoster: PresetBuffRosterSlot[],
  baseMain: SelectedMainDisc[],
  baseSupport: SelectedSupportDisc[],
  assumptions: DiscRankingAssumptions,
  allBaseBuffs: TeamBuffInput[],
  allBaseRotations: Partial<Record<SlotKey, RotationAbility[]>>,
  baseResult: TeamCalcResult,
  slot: SlotKey,
  skillSource: SkillLevelSource,
  isDps: boolean
): number | null {
  const baseFighter = baseResult.fighters.find((f) => f.state.slot === slot);
  if (!baseFighter) return null;

  const hasMvSlice = baseFighter.state.rotation.some((ab) => ab.source === skillSource);
  const buffPair = ctx.skillLv3BuffPairs?.[slot]?.[skillSource];
  if (!hasMvSlice && !buffPair) return null;

  const ratio = ctx.skillLv3Ratios?.[slot]?.[skillSource] ?? 1.21;
  const afterResult = evaluateTeamLoadout(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    baseMain,
    baseSupport,
    assumptions,
    {
      potentialBuffs: allBaseBuffs,
      extraRotations: allBaseRotations,
      includeSyntheticEmblems: false,
      ...(hasMvSlice ? { skillLv3Scale: { slot, skillSource, ratio } } : {}),
      ...(buffPair
        ? {
            skillLv3BuffOverride: {
              slot,
              skillSource,
              buffs: buffPair.atLv13,
            },
          }
        : {}),
    }
  );

  const beforeMetric = isDps ? baseFighter.totals.expected : baseResult.totalExpected;
  const afterMetric = isDps
    ? (afterResult.fighters.find((f) => f.state.slot === slot)?.totals.expected ?? 0)
    : afterResult.totalExpected;

  if (beforeMetric <= 0) return null;
  const gain = round2(((afterMetric - beforeMetric) / beforeMetric) * 100);
  return gain >= 0.05 ? gain : null;
}

export function computeEstimatedEmblemRankings(
  ctx: DiscRankingContext,
  assumptions: DiscRankingAssumptions
): EstimatedEmblemColumn[] {
  const { fighters, presetRoster, baseMain, baseSupport, discsLookup } = prepareLoadoutInputs(
    ctx,
    assumptions
  );
  const { coreBuffs, entries } = collectActivePotentialState(ctx, assumptions);

  const allBaseBuffs: TeamBuffInput[] = [
    ...coreBuffs,
    ...entries.flatMap((e) => e.baseBuffs),
  ];
  const allBaseRotations = buildExtraRotationsMap(
    entries.map((e) => ({ slot: e.entry.slot, slices: e.baseSlices }))
  );

  // Clean 0-emblem baseline (omit synthetic +110 PEN and 3x carry emblem placeholders)
  const baseResult = evaluateTeamLoadout(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    baseMain,
    baseSupport,
    assumptions,
    {
      potentialBuffs: allBaseBuffs,
      extraRotations: allBaseRotations,
      includeSyntheticEmblems: false,
    }
  );

  const totalExpected = baseResult.totalExpected;
  const slotOrder: SlotKey[] = ['vanguard', 'versatile', 'support'];
  const dpsSlots = slotOrder.filter((slot) => {
    const f = baseResult.fighters.find((item) => item.state.slot === slot);
    if (!f || totalExpected <= 0) return false;
    return f.totals.expected / totalExpected >= 0.05;
  });
  if (dpsSlots.length === 0) {
    dpsSlots.push(ctx.profile.carrySlot);
  }

  const columns: EstimatedEmblemColumn[] = [];

  for (const slot of dpsSlots) {
    const baseFighter = baseResult.fighters.find((f) => f.state.slot === slot);
    const rosterEntry = ctx.roster.find((r) => r.slot === slot);
    if (!baseFighter || !rosterEntry?.character) continue;

    const ownerBase = baseFighter.totals.expected;
    if (ownerBase <= 0) continue;

    const baselinePen = Math.round(baseFighter.stats.resPen);
    const dpsSharePct = totalExpected > 0 ? Math.round((ownerBase / totalExpected) * 100) : 0;

    // Damage types present in this slot's effective rotation (including potential extra hits)
    // Skill Lv +3 sources come strictly from base kit abilities (not potential procs)
    const activeTypes = new Set<DamageType>();
    const activeSources = new Set<SkillLevelSource>();
    const allowedSources: SkillLevelSource[] =
      slot === 'vanguard' ? ['normalAtk', 'skill', 'ultimate'] : ['supportSkill', 'ultimate'];
    for (const ab of baseFighter.state.rotation) {
      activeTypes.add(ab.damageType);
      if (ab.source !== 'custom' && allowedSources.includes(ab.source)) {
        activeSources.add(ab.source);
      }
    }
    for (const src of allowedSources) {
      if (ctx.skillLv3BuffPairs?.[slot]?.[src]) {
        activeSources.add(src);
      }
    }
    for (const ab of allBaseRotations[slot] ?? []) {
      activeTypes.add(ab.damageType);
    }

    type CandidateResult = {
      stat: string;
      dmgGain: number;
      groupKey: string;
    };
    const candidates: CandidateResult[] = [];

    const evalBuffCandidate = (
      label: string,
      buffs: TeamBuffInput[],
      baselineDmg: number,
      groupKey: string
    ) => {
      if (baselineDmg <= 0) return;
      const res = evaluateTeamLoadout(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        baseSupport,
        assumptions,
        {
          potentialBuffs: allBaseBuffs,
          extraRotations: allBaseRotations,
          includeSyntheticEmblems: false,
          extraBuffs: buffs,
        }
      );
      const after = res.fighters.find((f) => f.state.slot === slot)?.totals.expected ?? 0;
      const gain = round2(((after - baselineDmg) / baselineDmg) * 100);
      if (gain >= 0.05) {
        candidates.push({ stat: label, dmgGain: gain, groupKey });
      }
    };

    // 1. PEN Tier 1
    const penRainbow = getEmblemValue('80', 'RES PEN', 'Rainbow'); // 110
    const penYellow = getEmblemValue('80', 'RES PEN', 'Yellow'); // 53
    evalBuffCandidate(
      `${baselinePen} > ${baselinePen + penRainbow} PEN`,
      [{ target: slot, stat: 'resPen', value: penRainbow }],
      ownerBase,
      'pen-1'
    );
    evalBuffCandidate(
      `${baselinePen} > ${baselinePen + penYellow} PEN`,
      [{ target: slot, stat: 'resPen', value: penYellow }],
      ownerBase,
      'pen-1'
    );

    // 2. PEN Tier 2 (relative to +110 PEN baseline when slot starts at 0 PEN)
    if (baselinePen === 0) {
      const pen110Result = evaluateTeamLoadout(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        baseSupport,
        assumptions,
        {
          potentialBuffs: allBaseBuffs,
          extraRotations: allBaseRotations,
          includeSyntheticEmblems: false,
          extraBuffs: [{ target: slot, stat: 'resPen', value: penRainbow }],
        }
      );
      const ownerPen110 =
        pen110Result.fighters.find((f) => f.state.slot === slot)?.totals.expected ?? 0;
      evalBuffCandidate(
        `${penRainbow} > ${penRainbow * 2} PEN`,
        [{ target: slot, stat: 'resPen', value: penRainbow * 2 }],
        ownerPen110,
        'pen-2'
      );
      evalBuffCandidate(
        `${penRainbow} > ${penRainbow + penYellow} PEN`,
        [{ target: slot, stat: 'resPen', value: penRainbow + penYellow }],
        ownerPen110,
        'pen-2'
      );
    }

    // 3. Skill Lv +3 for each active kit skill source (unified with Skill +3 Matrix)
    for (const skillSource of activeSources) {
      const label = SKILL_LV3_LABEL[skillSource];
      const gain = evaluateSlotSkillPlus3(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        baseSupport,
        assumptions,
        allBaseBuffs,
        allBaseRotations,
        baseResult,
        slot,
        skillSource,
        true
      );
      if (gain !== null) {
        candidates.push({ stat: label, dmgGain: gain, groupKey: `skill-${skillSource}` });
      }
    }

    // 4. Primary stat (ATK% / HP% / DEF%)
    const scalingStat: ScalingStat = rosterEntry.combat?.scalingStat ?? 'ATK';
    if (scalingStat === 'HP') {
      const val = getEmblemValue('80', 'HP%', 'Rainbow') * 100;
      evalBuffCandidate(`${val}% HP`, [{ target: slot, stat: 'hpPct', value: val }], ownerBase, 'primary');
    } else if (scalingStat === 'DEF') {
      const val = getEmblemValue('80', 'DEF%', 'Rainbow') * 100;
      evalBuffCandidate(`${val}% DEF%`, [{ target: slot, stat: 'defPct', value: val }], ownerBase, 'primary');
    } else {
      const val = getEmblemValue('80', 'ATK% (Perma)', 'Rainbow') * 100;
      evalBuffCandidate(`${val}% ATK%`, [{ target: slot, stat: 'atkPctPerma', value: val }], ownerBase, 'primary');
    }

    // 5. Universal offensive rolls
    const critRateVal = getEmblemValue('80', 'Crit rate%', 'Rainbow') * 100;
    const critDmgVal = getEmblemValue('80', 'Crit dmg%', 'Yellow') * 100;
    const elemVal = getEmblemValue('80', 'Element', 'Rainbow') * 100;
    evalBuffCandidate(`${critRateVal}% Crit`, [{ target: slot, stat: 'critRate', value: critRateVal }], ownerBase, 'crit-rate');
    evalBuffCandidate(`${critDmgVal}% Crit DMG`, [{ target: slot, stat: 'critDmg', value: critDmgVal }], ownerBase, 'crit-dmg');
    evalBuffCandidate(`${elemVal}% Element`, [{ target: slot, stat: 'elementDmg', value: elemVal }], ownerBase, 'element');

    // 6. Type-specific rolls for active damage types
    for (const dmgType of activeTypes) {
      for (const spec of TYPE_EMBLEM_SPECS[dmgType]) {
        const val = getEmblemValue('80', spec.emblemKey, spec.rarity) * 100;
        evalBuffCandidate(spec.label, [{ target: slot, stat: spec.stat, value: val }], ownerBase, `type-${spec.stat}`);
      }
    }

    candidates.sort((a, b) => b.dmgGain - a.dmgGain || a.stat.localeCompare(b.stat));

    const targetRec = candidates.length >= 12 ? 5 : 4;
    const seenGroups = new Set<string>();
    let recCount = 0;

    const rows: EstimatedEmblemStatRow[] = candidates.map((c) => {
      let isRecommended = false;
      if (recCount < targetRec && !seenGroups.has(c.groupKey)) {
        isRecommended = true;
        seenGroups.add(c.groupKey);
        recCount++;
      }
      return {
        stat: c.stat,
        dmgGain: c.dmgGain,
        isRecommended,
      };
    });

    columns.push({
      slot,
      trekkerId: rosterEntry.character.id,
      label: rosterEntry.character.name.EN,
      palette: 'emerald',
      dpsSharePct,
      rows,
    });
  }

  return columns;
}

const SLOT_SKILL_HIGHLIGHT: Record<SlotKey, SkillHighlightTone> = {
  vanguard: 'rose',
  versatile: 'violet',
  support: 'cyan',
};

const SKILL_MATRIX_ROWS: ReadonlyArray<{
  skill: SkillPlus3Row['skill'];
  source: SkillLevelSource;
  slots: ReadonlyArray<SlotKey>;
}> = [
  { skill: 'AA', source: 'normalAtk', slots: ['vanguard'] },
  { skill: 'Main Skill', source: 'skill', slots: ['vanguard'] },
  { skill: 'Support Skill', source: 'supportSkill', slots: ['versatile', 'support'] },
  { skill: 'Ultimate', source: 'ultimate', slots: ['vanguard', 'versatile', 'support'] },
];

export function computeEstimatedSkillPlus3Matrix(
  ctx: DiscRankingContext,
  assumptions: DiscRankingAssumptions
): SkillPlus3Variant {
  const { fighters, presetRoster, baseMain, baseSupport, discsLookup } = prepareLoadoutInputs(
    ctx,
    assumptions
  );
  const { coreBuffs, entries } = collectActivePotentialState(ctx, assumptions);

  const allBaseBuffs: TeamBuffInput[] = [
    ...coreBuffs,
    ...entries.flatMap((e) => e.baseBuffs),
  ];
  const allBaseRotations = buildExtraRotationsMap(
    entries.map((e) => ({ slot: e.entry.slot, slices: e.baseSlices }))
  );

  const baseResult = evaluateTeamLoadout(
    ctx,
    discsLookup,
    fighters,
    presetRoster,
    baseMain,
    baseSupport,
    assumptions,
    {
      potentialBuffs: allBaseBuffs,
      extraRotations: allBaseRotations,
      includeSyntheticEmblems: false,
    }
  );

  const totalExpected = baseResult.totalExpected;
  const slotOrder: SlotKey[] = ['vanguard', 'versatile', 'support'];

  const colMeta = slotOrder
    .map((slot) => {
      const rosterEntry = ctx.roster.find((r) => r.slot === slot);
      const fighter = baseResult.fighters.find((f) => f.state.slot === slot);
      if (!rosterEntry?.character || !fighter) return null;
      const share = totalExpected > 0 ? fighter.totals.expected / totalExpected : 0;
      const isDps = slot === ctx.profile.carrySlot || share >= 0.05;
      return {
        slot,
        trekkerId: rosterEntry.character.id,
        label: isDps ? rosterEntry.character.name.EN : `${rosterEntry.character.name.EN} (Team)`,
        isDps,
        fighter,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const rawValues: Array<Array<number | null>> = SKILL_MATRIX_ROWS.map((rowDef) =>
    colMeta.map((col) => {
      if (!rowDef.slots.includes(col.slot)) return null;
      return evaluateSlotSkillPlus3(
        ctx,
        discsLookup,
        fighters,
        presetRoster,
        baseMain,
        baseSupport,
        assumptions,
        allBaseBuffs,
        allBaseRotations,
        baseResult,
        col.slot,
        rowDef.source,
        col.isDps
      );
    })
  );

  // Highlight the single strongest Skill +3 upgrade per Trekker column (matching ZiLenTz sheet palette)
  const bestRowByCol: number[] = colMeta.map((_, cIdx) => {
    let bestRow = -1;
    let bestVal = 0.5;
    for (let rIdx = 0; rIdx < rawValues.length; rIdx++) {
      const val = rawValues[rIdx][cIdx];
      if (val !== null && val >= bestVal) {
        bestVal = val;
        bestRow = rIdx;
      }
    }
    return bestRow;
  });

  const rows: SkillPlus3Row[] = SKILL_MATRIX_ROWS.map((rowDef, rIdx) => ({
    skill: rowDef.skill,
    cells: colMeta.map((col, cIdx): SkillPlus3Cell => {
      const value = rawValues[rIdx][cIdx];
      return {
        value,
        ...(bestRowByCol[cIdx] === rIdx && value !== null
          ? { highlight: SLOT_SKILL_HIGHLIGHT[col.slot] }
          : {}),
      };
    }),
  }));

  return {
    label: 'Estimated (Lv 10 → 13)',
    trekkerColumns: colMeta.map((c) => ({ trekkerId: c.trekkerId, label: c.label })),
    rows,
  };
}

/**
 * Computes live estimated T1..T5 Talent gain tables (vs T0 = 0%) for every occupied
 * slot in the squad using the active combat context, rotation, and assumptions.
 */
export function computeEstimatedTalentRankings(
  ctx: DiscRankingContext,
  assumptions: DiscRankingAssumptions
): TalentTrekkerTable[] {
  const { fighters, presetRoster, baseMain, baseSupport, discsLookup } = prepareLoadoutInputs(
    ctx,
    assumptions
  );
  const { coreBuffs, entries } = collectActivePotentialState(ctx, assumptions);
  const allBaseBuffs: TeamBuffInput[] = [
    ...coreBuffs,
    ...entries.flatMap((e) => e.baseBuffs),
  ];
  const allBaseRotations = buildExtraRotationsMap(
    entries.map((e) => ({ slot: e.entry.slot, slices: e.baseSlices }))
  );

  const evalAtTier = (slot: SlotKey, tier: number) =>
    evaluateTeamLoadout(
      ctx,
      discsLookup,
      fighters,
      presetRoster,
      baseMain,
      baseSupport,
      assumptions,
      {
        potentialBuffs: allBaseBuffs,
        extraRotations: allBaseRotations,
        talentTierOverrides: { [slot]: tier },
      }
    );

  const tables: TalentTrekkerTable[] = [];
  for (const slot of ['vanguard', 'versatile', 'support'] as const) {
    const rosterEntry = ctx.roster.find((r) => r.slot === slot);
    if (!rosterEntry?.character) continue;

    const r0 = evalAtTier(slot, 0);
    const p0 = r0.fighters.find((f) => f.state.slot === slot)?.totals.expected ?? 0;
    const t0 = r0.totalExpected;

    let prevP = p0;
    let prevT = t0;
    const tiers: TalentTierRow[] = [];

    for (let tier = 0; tier <= 5; tier++) {
      const rK = tier === 0 ? r0 : evalAtTier(slot, tier);
      const pK = rK.fighters.find((f) => f.state.slot === slot)?.totals.expected ?? 0;
      const tK = rK.totalExpected;

      const personalDmg = Math.round(pK);
      const personalInc = tier > 0 && p0 > 0 ? round2(((pK - p0) / p0) * 100) : 0;
      const personalRelativeInc =
        tier > 0 && prevP > 0 ? round2(((pK - prevP) / prevP) * 100) : 0;
      const teamDmg = Math.round(tK);
      const teamInc = tier > 0 && t0 > 0 ? round2(((tK - t0) / t0) * 100) : 0;
      const teamRelativeInc =
        tier > 0 && prevT > 0 ? round2(((tK - prevT) / prevT) * 100) : 0;

      tiers.push({
        tier,
        personalDmg,
        personalInc,
        personalRelativeInc,
        teamDmg,
        teamInc,
        teamRelativeInc,
      });

      prevP = pK;
      prevT = tK;
    }

    tables.push({
      trekkerId: rosterEntry.character.id,
      label: rosterEntry.character.name.EN,
      tiers,
    });
  }

  return tables;
}
