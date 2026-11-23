import type {
  NoteName,
  SSCharacter,
  SSDisc,
  SSPotentialFull,
  SelectedMainDisc,
} from '../../types/index.ts';
import type { BuffStatKey, DamageType } from './damage-engine.ts';
import type { CharacterCombatEntry, SlotKey } from './fighter-calc.ts';
import type { BuildCombatProfile, SlotDamageSlice } from './disc-rankings-client.ts';
import { parseSkillParts, type AbilitySource } from './motion-value-parser.ts';
import {
  extractDiscPresetBuffs,
  extractEffectsFromText,
  extractPotentialExtraHitSpecs,
  renderPotentialAtLevel,
  type PresetBuffRosterSlot,
} from './preset-buffs-core.ts';

export interface SynthesizedSlotSummary {
  slot: SlotKey;
  characterId: number;
  characterName: string;
  sharePct: number;
  topTypes: DamageType[];
}

export interface SynthesizedProfileSummary {
  carrySlot: SlotKey;
  primaryDamageType: DamageType;
  slots: SynthesizedSlotSummary[];
}

export interface SynthesizeProfileSlotInput {
  slot: SlotKey;
  character: SSCharacter | null;
  combat: CharacterCombatEntry | null;
  potentials: Array<{ pot: SSPotentialFull; level: number }>;
}

export interface SynthesizeProfileInput {
  roster: SynthesizeProfileSlotInput[];
  mainDiscs: SelectedMainDisc[];
  targetNotes: Partial<Record<NoteName, number>>;
  discsLookup: Record<string, SSDisc>;
  archetype?: string;
}

const ALL_DAMAGE_TYPES: readonly DamageType[] = [
  'Auto Attack',
  'Skill',
  'Ultimate',
  'Mark',
  'Minion',
];

const BUFF_STAT_TO_DAMAGE_TYPE: Partial<Record<BuffStatKey, DamageType>> = {
  aaDmg: 'Auto Attack',
  aaTaken: 'Auto Attack',
  aaCritRate: 'Auto Attack',
  aaCritDmg: 'Auto Attack',
  skillDmg: 'Skill',
  skillTaken: 'Skill',
  skillCritRate: 'Skill',
  skillCritDmg: 'Skill',
  ultDmg: 'Ultimate',
  ultTaken: 'Ultimate',
  ultCritRate: 'Ultimate',
  ultCritDmg: 'Ultimate',
  markDmg: 'Mark',
  markTaken: 'Mark',
  markCritRate: 'Mark',
  markCritDmg: 'Mark',
  minionDmg: 'Minion',
  minionTaken: 'Minion',
  minionCritRate: 'Minion',
  minionCritDmg: 'Minion',
};

const DAMAGE_TYPE_TO_BUFF_STAT: Record<DamageType, BuffStatKey> = {
  'Auto Attack': 'aaDmg',
  Skill: 'skillDmg',
  Ultimate: 'ultDmg',
  Mark: 'markDmg',
  Minion: 'minionDmg',
};

const SECONDARY_STAT_TO_DAMAGE_TYPE: Record<string, DamageType> = {
  'Auto Attack DMG': 'Auto Attack',
  'Skill DMG': 'Skill',
  'Ultimate DMG': 'Ultimate',
  'Mark DMG': 'Mark',
  'Minion DMG': 'Minion',
};

function parseCooldownSec(skill: unknown, source: AbilitySource): number {
  const floor = source === 'ultimate' ? 20 : source === 'normalAtk' ? 2.5 : 6;
  if (!skill || typeof skill !== 'object') return floor;
  const rawCd = (skill as { cooldown?: unknown }).cooldown;
  if (typeof rawCd === 'number' && Number.isFinite(rawCd)) {
    return Math.max(floor, rawCd);
  }
  if (typeof rawCd === 'string') {
    const m = rawCd.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const parsed = Number.parseFloat(m[1]);
      if (Number.isFinite(parsed)) return Math.max(floor, parsed);
    }
  }
  return floor;
}

function getSlotAbilitySources(slot: SlotKey): AbilitySource[] {
  return slot === 'vanguard'
    ? ['normalAtk', 'skill', 'ultimate']
    : ['supportSkill', 'ultimate'];
}

function canonicalSkillSource(type: DamageType, slot: SlotKey): AbilitySource | undefined {
  if (type === 'Auto Attack') return 'normalAtk';
  if (type === 'Skill') return slot === 'vanguard' ? 'skill' : 'supportSkill';
  if (type === 'Ultimate') return 'ultimate';
  return undefined;
}

function computeSlotDpsAndTypes(
  slotInput: SynthesizeProfileSlotInput
): {
  dpsProxy: number;
  skillTypeShares: Record<DamageType, number>;
  primarySkillSourceByType: Partial<Record<DamageType, AbilitySource>>;
} {
  const skillTypeShares: Record<DamageType, number> = {
    'Auto Attack': 0,
    Skill: 0,
    Ultimate: 0,
    Mark: 0,
    Minion: 0,
  };
  const primarySkillSourceByType: Partial<Record<DamageType, AbilitySource>> = {};
  const bestSourceScoreByType: Partial<Record<DamageType, number>> = {};

  if (!slotInput.combat) {
    return { dpsProxy: 0, skillTypeShares, primarySkillSourceByType };
  }

  let totalDps = 0;
  for (const source of getSlotAbilitySources(slotInput.slot)) {
    const skill = slotInput.combat[source];
    if (!skill) continue;
    const parts = parseSkillParts(skill, source, 10);
    if (parts.length === 0) continue;

    const cd = parseCooldownSec(skill, source);
    let skillDps = 0;
    for (const part of parts) {
      const normFactor = part.scalingStat === 'HP' ? 1 / 0.16 : 1;
      const partDps = (part.mvPct * Math.max(1, part.hits) * normFactor) / cd;
      skillDps += partDps;
      skillTypeShares[part.damageType] += partDps;
      const canonical = canonicalSkillSource(part.damageType, slotInput.slot);
      if (canonical && slotInput.combat[canonical]) {
        primarySkillSourceByType[part.damageType] = canonical;
      } else {
        const prevBest = bestSourceScoreByType[part.damageType] ?? -1;
        if (partDps > prevBest) {
          bestSourceScoreByType[part.damageType] = partDps;
          primarySkillSourceByType[part.damageType] = source;
        }
      }
    }
    totalDps += skillDps;
  }

  return { dpsProxy: totalDps, skillTypeShares, primarySkillSourceByType };
}

function classPrior(charClass: string | undefined): number {
  const c = (charClass ?? '').toLowerCase();
  if (c === 'vanguard') return 1.0;
  if (c === 'versatile') return 0.78;
  if (c === 'support') return 0.14;
  return 0.65;
}

export function synthesizeCombatProfile(input: SynthesizeProfileInput): {
  profile: BuildCombatProfile;
  summary: SynthesizedProfileSummary;
} {
  const occupied = input.roster.filter((r) => r.character !== null);
  if (occupied.length === 0) {
    return {
      profile: {
        carrySlot: 'vanguard',
        carryTypeStat: 'skillDmg',
        slots: { vanguard: [{ type: 'Skill', weight: 10000 }] },
      },
      summary: {
        carrySlot: 'vanguard',
        primaryDamageType: 'Skill',
        slots: [],
      },
    };
  }

  const slotSkillData = new Map<
    SlotKey,
    ReturnType<typeof computeSlotDpsAndTypes>
  >();
  const slotPersonalTypeScores = new Map<SlotKey, Record<DamageType, number>>();
  const teamTypeAmplifiers: Record<DamageType, number> = {
    'Auto Attack': 0,
    Skill: 0,
    Ultimate: 0,
    Mark: 0,
    Minion: 0,
  };
  const slotOffensiveScores = new Map<SlotKey, number>();

  // Determine dominant squad element (prefer Main Discs' element, fallback to vanguard element)
  const elemCounts = new Map<string, number>();
  for (const md of input.mainDiscs) {
    const disc = md.discId ? input.discsLookup[String(md.discId)] : undefined;
    if (disc && disc.element && disc.element !== 'None') {
      elemCounts.set(disc.element, (elemCounts.get(disc.element) ?? 0) + 2);
    }
  }
  let versatileSynergyBonus = 0;

  for (const r of occupied) {
    const el = r.character?.element;
    if (el) elemCounts.set(el, (elemCounts.get(el) ?? 0) + (r.slot === 'vanguard' ? 1.5 : 1));
  }
  let squadElement: string | undefined;
  let bestElemCount = -1;
  for (const [el, cnt] of elemCounts.entries()) {
    if (cnt > bestElemCount) {
      bestElemCount = cnt;
      squadElement = el;
    }
  }

  for (const r of occupied) {
    const skillData = computeSlotDpsAndTypes(r);
    slotSkillData.set(r.slot, skillData);

    const ownTypeScores: Record<DamageType, number> = {
      'Auto Attack': 0,
      Skill: 0,
      Ultimate: 0,
      Mark: 0,
      Minion: 0,
    };
    const ownCritTypeScores: Record<DamageType, number> = {
      'Auto Attack': 0,
      Skill: 0,
      Ultimate: 0,
      Mark: 0,
      Minion: 0,
    };

    let personalPts = 0;
    let supportPts = 0;

    for (const { pot, level } of r.potentials) {
      const potWeight = pot.isCore ? 2.5 : Math.max(0.5, level / 6);
      const typePotWeight = pot.isCore ? 3.0 : Math.max(0.5, level / 6);
      const rendered = renderPotentialAtLevel(pot.descTemplate, pot.params, pot.isCore ? 1 : level);
      const effects = extractEffectsFromText(rendered, 'own');
      const extraHits = extractPotentialExtraHitSpecs(rendered, 'ATK');

      const hasHealOrShield = /\b(?:heal|restore|shield|barrier|hp recovery)\b/i.test(rendered);
      if (hasHealOrShield) {
        supportPts += 1.5 * potWeight;
      }

      for (const eff of effects) {
        const isTeamOrEnemy =
          eff.targetHint !== 'own' || eff.stat.endsWith('Taken');

        const isCritTypeStat =
          eff.stat.endsWith('CritRate') || eff.stat.endsWith('CritDmg');
        const mappedType = BUFF_STAT_TO_DAMAGE_TYPE[eff.stat];
        if (isTeamOrEnemy) {
          supportPts += 2.2 * potWeight;
          if (mappedType && !isCritTypeStat) {
            teamTypeAmplifiers[mappedType] += 2.2 * typePotWeight;
          }
        } else {
          personalPts += 2.0 * potWeight;
          if (mappedType) {
            if (isCritTypeStat) {
              ownCritTypeScores[mappedType] += 1.5 * typePotWeight;
            } else {
              ownTypeScores[mappedType] += 3.0 * typePotWeight;
            }
          } else if (
            eff.stat === 'atkPct' ||
            eff.stat === 'critRate' ||
            eff.stat === 'critDmg' ||
            eff.stat === 'elementDmg'
          ) {
            personalPts += 0.8 * potWeight;
          }
        }
      }

      for (const hit of extraHits) {
        personalPts += 2.5 * potWeight;
        ownTypeScores[hit.damageType] += 3.5 * typePotWeight;
      }

      if (/\bmark(?:'s)?\s+(?:dmg|damage)\b/i.test(rendered)) {
        if (pot.isCore || /\ballies\b|\bsquad\b|\bteam\b/i.test(rendered)) {
          teamTypeAmplifiers.Mark += 4.0 * typePotWeight;
        }
        ownTypeScores.Mark += 4.0 * typePotWeight;
      }
      if (/\bminion(?:'s)?\s+(?:dmg|damage)\b/i.test(rendered)) {
        ownTypeScores.Minion += 2.5 * typePotWeight;
      }
    }

    // Fall back to type-specific Crit Rate/Crit DMG signals when a Trekker invests
    // in a damage type purely through crit potentials (e.g. Eleanor Skill Crit).
    for (const t of ALL_DAMAGE_TYPES) {
      if (ownTypeScores[t] === 0 && ownCritTypeScores[t] > 0) {
        ownTypeScores[t] = ownCritTypeScores[t];
      }
    }

    slotPersonalTypeScores.set(r.slot, ownTypeScores);

    const personalFocus = personalPts / (personalPts + supportPts + 1);
    const charClass = r.character?.class ?? r.combat?.class;
    let base = classPrior(charClass);
    if (r.slot === 'vanguard' && (charClass ?? '').toLowerCase() !== 'support') {
      base = Math.max(1.42, base + 0.38);
    } else if (r.slot === 'support') {
      base *= 0.36;
    }

    // Smooth continuous scaling for off-field element-matching DPS (no step cliff)
    if (r.slot !== 'vanguard' && squadElement && r.character?.element === squadElement) {
      const smoothFocus = Math.max(0, Math.min(1, (personalFocus - 0.80) / 0.07));
      base *= 1 + 1.24 * smoothFocus;
    }

    const rawFocusScale = 0.35 + 1.25 * personalFocus;
    const focusScale =
      r.slot === 'vanguard' && (charClass ?? '').toLowerCase() !== 'support'
        ? Math.max(0.92, rawFocusScale)
        : rawFocusScale;
    const dpsFactor = Math.max(0.75, Math.min(1.35, 0.75 + skillData.dpsProxy / 240));
    const rawScore = Math.max(0.05, base * focusScale * dpsFactor);
    slotOffensiveScores.set(r.slot, Math.pow(rawScore, 1.52));
  }

  let carrySlot: SlotKey = occupied[0].slot;
  let bestSlotScore = -1;
  for (const r of occupied) {
    const score = slotOffensiveScores.get(r.slot) ?? 0;
    if (score > bestSlotScore) {
      bestSlotScore = score;
      carrySlot = r.slot;
    }
  }

  // Normalize Stage 1 slot shares onto 10000 MV budget
  const scoreSum = occupied.reduce((acc, r) => acc + (slotOffensiveScores.get(r.slot) ?? 0), 0);
  const slotWeightBudgets = new Map<SlotKey, number>();
  for (const r of occupied) {
    const frac = scoreSum > 0 ? (slotOffensiveScores.get(r.slot) ?? 0) / scoreSum : 1 / occupied.length;
    slotWeightBudgets.set(r.slot, Math.max(250, Math.round(frac * 10000)));
  }

  const presetRoster: PresetBuffRosterSlot[] = input.roster.map((r) => ({
    slot: r.slot,
    character: r.character,
  }));
  const carryDiscTypeSignals: Record<DamageType, number> = {
    'Auto Attack': 0,
    Skill: 0,
    Ultimate: 0,
    Mark: 0,
    Minion: 0,
  };

  for (const md of input.mainDiscs) {
    const disc = md.discId ? input.discsLookup[String(md.discId)] : undefined;
    if (!disc) continue;
    const lv90 = disc.stats?.lv90;
    if (lv90) {
      for (const [statKey, val] of Object.entries(lv90)) {
        const mapped = SECONDARY_STAT_TO_DAMAGE_TYPE[statKey];
        const numVal = parseFloat(String(val));
        if (mapped && Number.isFinite(numVal) && numVal > 0) {
          carryDiscTypeSignals[mapped] += Math.min(3.5, Math.max(1.5, numVal / 15));
        }
      }
    }
  }

  const discBuffs = extractDiscPresetBuffs(
    input.mainDiscs,
    input.targetNotes,
    input.discsLookup,
    presetRoster,
    undefined,
    { enforceTriggers: true, fightMode: 'single', uptimeMode: 'realistic' }
  );
  for (const b of discBuffs) {
    if (!b.enabled) continue;
    const mapped = BUFF_STAT_TO_DAMAGE_TYPE[b.stat];
    if (mapped) {
      carryDiscTypeSignals[mapped] += Math.min(3.5, Math.max(0.5, b.value / 15));
    }
  }

  const focusNotes = Number(input.targetNotes['Melody of Focus'] ?? 0);
  const skillNotes = Number(input.targetNotes['Melody of Skill'] ?? 0);
  const ultNotes = Number(input.targetNotes['Melody of Ultimate'] ?? 0);
  if (focusNotes > 0) carryDiscTypeSignals['Auto Attack'] += Math.min(4.0, focusNotes / 8);
  if (skillNotes > 0) carryDiscTypeSignals.Skill += Math.min(4.0, skillNotes / 8);
  if (ultNotes > 0) carryDiscTypeSignals.Ultimate += Math.min(4.0, ultNotes / 8);

  // Stage 2: Build per-slot SlotDamageSlice[]
  const slots: Partial<Record<SlotKey, SlotDamageSlice[]>> = {};
  const archLower = (input.archetype ?? '').toLowerCase();

  for (const r of occupied) {
    const budget = slotWeightBudgets.get(r.slot) ?? 0;
    const ownScores = { ...slotPersonalTypeScores.get(r.slot)! };
    const skillData = slotSkillData.get(r.slot)!;
    const skillSum = ALL_DAMAGE_TYPES.reduce((acc, t) => acc + skillData.skillTypeShares[t], 0);

    const combined: Record<DamageType, number> = {
      'Auto Attack': 0,
      Skill: 0,
      Ultimate: 0,
      Mark: 0,
      Minion: 0,
    };

    const hasMarkInvestment =
      ownScores.Mark > 0 || (r.slot === carrySlot && teamTypeAmplifiers.Mark > 0);
    const effectiveSkillShares: Record<DamageType, number> = { ...skillData.skillTypeShares };
    if (!hasMarkInvestment && effectiveSkillShares.Mark > 0) {
      effectiveSkillShares.Skill += effectiveSkillShares.Mark;
      effectiveSkillShares.Mark = 0;
    }

    if (hasMarkInvestment && skillData.skillTypeShares.Mark > 0) {
      for (const { pot, level } of r.potentials) {
        const typePotWeight = pot.isCore ? 3.0 : Math.max(0.5, level / 6);
        const rendered = renderPotentialAtLevel(pot.descTemplate, pot.params, pot.isCore ? 1 : level);
        if (/\bmark\b/i.test(rendered) && !/\bmark(?:'s)?\s+(?:dmg|damage)\b/i.test(rendered)) {
          ownScores.Mark += 3.0 * typePotWeight;
        }
      }
    }

    // Detect Core potential skill-source coupling (e.g. "After casting Main Skill ... deals Ultimate DMG")
    const coreTexts = r.potentials
      .filter(({ pot }) => pot.isCore)
      .map(({ pot }) => renderPotentialAtLevel(pot.descTemplate, pot.params, 1))
      .join('\n');
    const coreMentionsMainSkill = /\bmain\s+skill\b/i.test(coreTexts);
    const coreMentionsSupportSkill = /\bsupport\s+skill\b/i.test(coreTexts);
    const coreMentionsUltDmg = /\bultimate\s+dmg\b/i.test(coreTexts);
    if (coreMentionsUltDmg && r.slot === 'vanguard' && coreMentionsMainSkill) {
      skillData.primarySkillSourceByType.Ultimate = 'skill';
    } else if (coreMentionsUltDmg && r.slot !== 'vanguard' && coreMentionsSupportSkill) {
      skillData.primarySkillSourceByType.Ultimate = 'supportSkill';
    }

    const potWeightSum = ALL_DAMAGE_TYPES.reduce((acc, t) => acc + ownScores[t], 0);
    for (const t of ALL_DAMAGE_TYPES) {
      if (
        r.slot !== 'vanguard' &&
        t === 'Auto Attack' &&
        (ownScores.Skill > 0 || ownScores['Auto Attack'] <= 0)
      ) {
        combined[t] = 0;
        continue;
      }
      const skillMult = r.slot === 'versatile' ? 5.2 : 2.8;
      const rawSkillShare = skillSum > 0 ? (effectiveSkillShares[t] / skillSum) * skillMult : 0;
      const skillShare =
        t === 'Ultimate' && ownScores.Ultimate <= 0 && r.slot !== 'vanguard'
          ? rawSkillShare * 0.48
          : rawSkillShare;
      const ownPot =
        t === 'Ultimate'
          ? r.slot === 'vanguard'
            ? ownScores[t] * 2.05
            : Math.min(ownScores[t] * 0.35, 1.2)
          : t === 'Mark'
            ? ownScores[t] * 2.6
            : ownScores[t];
      const teamAmp =
        r.slot === carrySlot
          ? teamTypeAmplifiers[t] * (t === 'Mark' ? 2.6 : t === 'Ultimate' ? 1.2 : 0.75)
          : 0;
      const discSig =
        r.slot === carrySlot
          ? carryDiscTypeSignals[t] * (t === 'Ultimate' ? 1.45 : 0.65)
          : 0;
      let score = ownPot + teamAmp + discSig + skillShare;
      if (potWeightSum === 0 && t === 'Skill') {
        score += 0.5;
      }

      if (archLower && r.slot === carrySlot) {
        if (
          (t === 'Mark' && archLower.includes('mark')) ||
          (t === 'Ultimate' && archLower.includes('ultimate')) ||
          (t === 'Auto Attack' && (archLower.includes('auto attack') || archLower.includes(' aa'))) ||
          (t === 'Skill' && archLower.includes('skill')) ||
          (t === 'Minion' && archLower.includes('minion'))
        ) {
          score *= 1.15;
        }
      }
      combined[t] = score;
    }

    const totalTypeScore = ALL_DAMAGE_TYPES.reduce((acc, t) => acc + combined[t], 0);
    if (totalTypeScore <= 0) {
      slots[r.slot] = [{ type: 'Skill', weight: budget }];
      continue;
    }

    if (
      r.slot === 'vanguard' &&
      combined.Ultimate >= combined.Skill &&
      effectiveSkillShares.Skill > 0 &&
      skillData.primarySkillSourceByType.Ultimate !== 'skill'
    ) {
      combined.Skill = Math.max(combined.Skill, totalTypeScore * 0.25);
    }

    // Skill-primary off-field Trekkers (whether Skill carry like Eleanor or sub-DPS like Otoha)
    // cast Support Skill frequently while their long-CD Ultimate is a small fraction of kit damage.
    // Genuine Ultimate carries (where Ultimate >= Skill or pot focus emphasizes Ultimate) are untouched.
    if (
      r.slot !== 'vanguard' &&
      combined.Skill > 0 &&
      combined.Ultimate > 0 &&
      (combined.Skill > combined.Ultimate * 2.2 ||
        (r.slot !== carrySlot && combined.Skill > combined.Ultimate * 1.15))
    ) {
      combined.Ultimate = Math.min(combined.Skill * 0.065, combined.Ultimate);
    }

    const adjustedTotalTypeScore = ALL_DAMAGE_TYPES.reduce((acc, t) => acc + combined[t], 0);
    const keptTypes = ALL_DAMAGE_TYPES.filter((t) => combined[t] / adjustedTotalTypeScore >= 0.005);
    const activeTypes = keptTypes.length > 0 ? keptTypes : ALL_DAMAGE_TYPES.filter((t) => combined[t] > 0);
    const keptSum = activeTypes.reduce((acc, t) => acc + combined[t], 0);

    const slotSlices: SlotDamageSlice[] = [];
    for (const t of activeTypes.sort((a, b) => combined[b] - combined[a])) {
      const w = Math.max(1, Math.round((combined[t] / keptSum) * budget));
      const src = skillData.primarySkillSourceByType[t] ?? canonicalSkillSource(t, r.slot);
      if (t === 'Ultimate' && r.slot === 'vanguard' && coreMentionsUltDmg && coreMentionsMainSkill) {
        const mainSkillPart = Math.max(1, Math.round(w * 0.87));
        const ultPart = Math.max(1, w - mainSkillPart);
        slotSlices.push({ type: 'Ultimate', weight: mainSkillPart, skillSource: 'skill' });
        slotSlices.push({ type: 'Ultimate', weight: ultPart, skillSource: 'ultimate' });
      } else {
        slotSlices.push({
          type: t,
          weight: w,
          ...(src ? { skillSource: src } : {}),
        });
      }
    }
    slots[r.slot] = slotSlices;
  }

  const carrySlices = slots[carrySlot] ?? [{ type: 'Skill' as DamageType, weight: 10000 }];
  const primaryDamageType: DamageType = carrySlices[0]?.type ?? 'Skill';

  const totalFinalWeight = occupied.reduce(
    (acc, r) => acc + (slots[r.slot]?.reduce((s, sl) => s + sl.weight, 0) ?? 0),
    0
  );

  const rawSummaries = occupied.map((r) => {
    const slotSlices = slots[r.slot] ?? [];
    const slotW = slotSlices.reduce((s, sl) => s + sl.weight, 0);
    const exactPct = totalFinalWeight > 0 ? (slotW / totalFinalWeight) * 100 : 100 / occupied.length;
    return {
      slot: r.slot,
      characterId: r.character!.id,
      characterName: r.character!.name.EN,
      exactPct,
      sharePct: Math.floor(exactPct),
      topTypes: Array.from(new Set(slotSlices.map((s) => s.type))).slice(0, 2),
    };
  });

  let remainder = 100 - rawSummaries.reduce((acc, s) => acc + s.sharePct, 0);
  const byFrac = [...rawSummaries].sort((a, b) => (b.exactPct - b.sharePct) - (a.exactPct - a.sharePct));
  for (let i = 0; i < byFrac.length && remainder > 0; i++, remainder--) {
    byFrac[i].sharePct += 1;
  }

  const summary: SynthesizedProfileSummary = {
    carrySlot,
    primaryDamageType,
    slots: rawSummaries.map(({ exactPct: _drop, ...rest }) => rest),
  };

  return {
    profile: {
      carrySlot,
      carryTypeStat: DAMAGE_TYPE_TO_BUFF_STAT[primaryDamageType],
      slots,
    },
    summary,
  };
}
