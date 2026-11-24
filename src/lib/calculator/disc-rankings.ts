import type { ResolvedCommunityPreset } from '../community-presets.ts';
import { getPotentialById } from '../potentials.ts';
import type {
  ElementType,
  SSCharacter,
  SSDisc,
  SSPotentialFull,
} from '../../types/index.ts';
import { ELEMENTS, type ScalingStat } from './damage-engine.ts';
import type {
  CharacterCombatEntry,
  FighterInput,
  SlotKey,
  TeamBuffInput,
} from './fighter-calc.ts';
import {
  estimatePotentialRealisticUptime,
  extractEffectsFromText,
  extractPotentialExtraHitSpecs,
  extractPotentialPresetBuffs,
  extractSkillKitPresetBuffs,
  isPotentialSquadConditionBlocked,
  renderPotentialAtLevel,
  resolveTargetsForEffect,
  type PresetBuffRosterSlot,
} from './preset-buffs.ts';
import {
  detectScalingStat,
  hasGenericSecondaryStat,
  type BaseSkillBuffInput,
  type DiscRankingContext,
  type DiscRankingRosterEntry,
  type SkillLevelSource,
  type SkillLv3BuffPair,
  type SlicedCombatStats,
  type SlicedPotentialEntry,
} from './disc-rankings-client.ts';
import {
  deriveProfileFromRotation,
  hasActiveRotationEntries,
  type ParsedRotationSkillOption,
} from './build-rotation.ts';
import {
  synthesizeCombatProfile,
  type SynthesizeProfileSlotInput,
} from './combat-profile-synthesizer.ts';
import { parseSkillParts } from './motion-value-parser.ts';

export * from './disc-rankings-client.ts';

function getPotentialTierCap(pot: SSPotentialFull): number {
  let maxLen = 1;
  for (const p of pot.params || []) {
    const len = String(p).split('/').length;
    if (len > maxLen) maxLen = len;
  }
  return Math.min(9, Math.max(pot.maxLevel || 1, maxLen));
}

function computeMedianSkillLv3Ratio(params: string[] | undefined): number {
  const ratios: number[] = [];
  for (const p of params || []) {
    const tiers = String(p).split('/');
    if (tiers.length < 13) continue;
    const v9 = parseFloat(tiers[9]);
    const v12 = parseFloat(tiers[12]);
    if (Number.isFinite(v9) && Number.isFinite(v12) && v9 > 0 && v12 > 0) {
      ratios.push(v12 / v9);
    }
  }
  if (ratios.length === 0) return 1.21;
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 === 1 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return +median.toFixed(4);
}

function extractSkillLv3BuffPair(
  skill: { desc?: string; params?: string[] } | undefined,
  roster: PresetBuffRosterSlot[],
  ownerSlot: SlotKey,
  isUltimate: boolean
): SkillLv3BuffPair | undefined {
  if (!skill?.desc) return undefined;
  const params = skill.params || [];
  const txt10 = renderPotentialAtLevel(skill.desc, params, 10);
  const txt13 = renderPotentialAtLevel(skill.desc, params, 13);
  if (txt10 === txt13) return undefined;

  const parseAt = (txt: string): TeamBuffInput[] => {
    const effects = extractEffectsFromText(txt, 'own');
    const out: TeamBuffInput[] = [];
    for (const eff of effects) {
      if (isPotentialSquadConditionBlocked(eff.clause, roster)) continue;
      if (/Safety\s+Alert:\s*\d+%/i.test(eff.clause)) continue;
      if (Math.abs(eff.value) > 500 && !eff.stacks) continue;
      const clauseWithContext = isUltimate ? `(Ultimate) ${eff.clause}` : eff.clause;
      const uptime = estimatePotentialRealisticUptime(
        clauseWithContext,
        eff.stacks,
        eff.durationSec
      );
      const targets = resolveTargetsForEffect(eff, roster, ownerSlot);
      for (const target of targets) {
        out.push({
          target,
          stat: eff.stat,
          value: eff.value,
          ...(uptime !== 1 ? { realisticUptime: uptime } : {}),
        });
      }
    }
    return out;
  };

  const atLv10 = parseAt(txt10);
  const atLv13 = parseAt(txt13);
  if (atLv13.length === 0) return undefined;

  const sumByKey = (list: TeamBuffInput[]) => {
    const map = new Map<string, number>();
    for (const b of list) {
      const k = `${b.target}:${b.stat}`;
      map.set(k, (map.get(k) || 0) + b.value);
    }
    return map;
  };
  const m10 = sumByKey(atLv10);
  const m13 = sumByKey(atLv13);
  let hasPositiveDelta = false;
  for (const [k, v13] of m13.entries()) {
    if (v13 > (m10.get(k) || 0) + 1e-4) {
      hasPositiveDelta = true;
      break;
    }
  }
  return hasPositiveDelta ? { atLv10, atLv13 } : undefined;
}

export function buildDiscRankingContext(
  preset: ResolvedCommunityPreset,
  allCharacters: Record<string, SSCharacter>,
  allCombat: Record<string, CharacterCombatEntry>,
  allDiscs: Record<string, SSDisc>,
  allPotentials?: Record<string, SSPotentialFull[]>
): DiscRankingContext {
  const roster: DiscRankingRosterEntry[] = (['vanguard', 'versatile', 'support'] as const).map(
    (slot) => {
      const cid = preset.advData.slots[slot]?.characterId;
      const character = cid ? allCharacters[String(cid)] || null : null;
      const fullCombat = cid ? allCombat[String(cid)] || null : null;
      const combat: SlicedCombatStats | null = fullCombat
        ? {
            id: fullCombat.id,
            name: fullCombat.name,
            star: fullCombat.star,
            element: fullCombat.element,
            class: fullCombat.class,
            scalingStat: detectScalingStat(fullCombat),
            stats: fullCombat.stats,
          }
        : null;
      return { slot, character, combat };
    }
  );

  const presetRoster: PresetBuffRosterSlot[] = roster.map((r) => ({
    slot: r.slot,
    character: r.character,
  }));

  const potLookup = (cid: number | null, pid: number): SSPotentialFull | undefined => {
    if (!cid) return undefined;
    if (allPotentials) {
      return allPotentials[String(cid)]?.find((p) => p.id === pid);
    }
    return getPotentialById(cid, pid);
  };

  const rawPotBuffs = extractPotentialPresetBuffs(
    {
      id: preset.id,
      name: preset.title,
      createdAt: 0,
      ...preset.advData,
    },
    presetRoster,
    { potentialLookup: potLookup }
  );
  const basePotentialBuffs: TeamBuffInput[] = rawPotBuffs
    .filter((b) => b.enabled)
    .map((b) => ({
      target: b.target,
      stat: b.stat,
      value: b.value,
      ...(b.realisticUptime !== undefined ? { realisticUptime: b.realisticUptime } : {}),
    }));

  const emptyEmblems = { '70': [], '80': [], '90': [] };
  const tempFighters: FighterInput[] = roster.map((r) => {
    const cid = preset.advData.slots[r.slot]?.characterId;
    const fullCombat = cid ? allCombat[String(cid)] || null : null;
    return {
      state: {
        slot: r.slot,
        level: '90',
        skillLevel: 10,
        affinityLevel: 30,
        talentTier: r.character?.star === 4 ? 5 : 0,
        emblems: emptyEmblems,
        rotation: [],
      },
      character: r.character,
      combat: fullCombat,
    };
  });
  const baseSkillBuffs: BaseSkillBuffInput[] = extractSkillKitPresetBuffs(
    tempFighters,
    presetRoster
  )
    .filter((b) => b.enabled)
    .map((b) => {
      const skillSource = b.id.split('-')[2] as SkillLevelSource | undefined;
      return {
        target: b.target,
        stat: b.stat,
        value: b.value,
        ...(b.realisticUptime !== undefined ? { realisticUptime: b.realisticUptime } : {}),
        ...(b.slot ? { slot: b.slot } : {}),
        ...(skillSource ? { skillSource } : {}),
      };
    });

  const corePotentialBuffs: TeamBuffInput[] = [];
  const potentials: SlicedPotentialEntry[] = [];
  const skillLv3Ratios: Partial<Record<SlotKey, Partial<Record<SkillLevelSource, number>>>> = {};
  const skillLv3BuffPairs: Partial<
    Record<SlotKey, Partial<Record<SkillLevelSource, SkillLv3BuffPair>>>
  > = {};
  const parsedSkillsBySlot: Partial<Record<SlotKey, ParsedRotationSkillOption[]>> = {};
  const synthRoster: SynthesizeProfileSlotInput[] = [];

  for (const r of roster) {
    const slotKey = r.slot;
    const slotData = preset.advData.slots[slotKey];
    const cid = slotData?.characterId;
    const fullCombat = cid ? allCombat[String(cid)] || null : null;
    const slotPotsForSynth: Array<{ pot: SSPotentialFull; level: number }> = [];
    if (fullCombat) {
      skillLv3Ratios[slotKey] = {
        normalAtk: computeMedianSkillLv3Ratio(fullCombat.normalAtk?.params),
        skill: computeMedianSkillLv3Ratio(fullCombat.skill?.params),
        supportSkill: computeMedianSkillLv3Ratio(fullCombat.supportSkill?.params),
        ultimate: computeMedianSkillLv3Ratio(fullCombat.ultimate?.params),
      };
      const slotPairs: Partial<Record<SkillLevelSource, SkillLv3BuffPair>> = {};
      const sources: SkillLevelSource[] =
        slotKey === 'vanguard' ? ['normalAtk', 'skill', 'ultimate'] : ['supportSkill', 'ultimate'];
      const slotParsedOptions: ParsedRotationSkillOption[] = [];
      const scalingStat: ScalingStat = r.combat?.scalingStat ?? 'ATK';
      for (const src of sources) {
        const skillEntry = fullCombat[src];
        if (skillEntry) {
          const rawCd = (skillEntry as { cooldown?: unknown }).cooldown;
          let cooldownSec: number | null = null;
          if (typeof rawCd === 'number' && Number.isFinite(rawCd)) {
            cooldownSec = rawCd;
          } else if (typeof rawCd === 'string') {
            const m = rawCd.match(/(\d+(?:\.\d+)?)/);
            if (m) cooldownSec = Number.parseFloat(m[1]);
          }
          const parts = parseSkillParts(skillEntry, src, 10);
          for (const part of parts) {
            slotParsedOptions.push({
              id: `${src}-${part.id}`,
              source: src,
              name: skillEntry.name,
              partLabel: part.label,
              damageType: part.damageType,
              scalingStat: part.scalingStat === 'HP' ? 'HP' : scalingStat === 'HP' ? 'HP' : 'ATK',
              motionValuePct: part.mvPct,
              hits: part.hits,
              cooldownSec,
            });
          }
        }
        const pair = extractSkillLv3BuffPair(
          skillEntry,
          presetRoster,
          slotKey,
          src === 'ultimate'
        );
        if (pair) slotPairs[src] = pair;
      }
      if (slotParsedOptions.length > 0) {
        parsedSkillsBySlot[slotKey] = slotParsedOptions;
      }
      if (Object.keys(slotPairs).length > 0) {
        skillLv3BuffPairs[slotKey] = slotPairs;
      }
    }

    if (cid && slotData?.potentials?.length) {
      const charName = r.character?.name?.EN ?? `Slot ${slotKey}`;
      const defaultScaling: ScalingStat = r.combat?.scalingStat ?? 'ATK';

      const extractSinglePotAtLevel = (pot: SSPotentialFull, lvl: number): TeamBuffInput[] => {
        const singleBuild = {
          id: preset.id,
          name: preset.title,
          createdAt: 0,
          ...preset.advData,
          slots: {
            vanguard: {
              characterId: preset.advData.slots.vanguard?.characterId ?? null,
              potentials: slotKey === 'vanguard' ? [{ id: pot.id, rarity: pot.rarityNum, level: lvl }] : [],
            },
            versatile: {
              characterId: preset.advData.slots.versatile?.characterId ?? null,
              potentials: slotKey === 'versatile' ? [{ id: pot.id, rarity: pot.rarityNum, level: lvl }] : [],
            },
            support: {
              characterId: preset.advData.slots.support?.characterId ?? null,
              potentials: slotKey === 'support' ? [{ id: pot.id, rarity: pot.rarityNum, level: lvl }] : [],
            },
          },
        };
        return extractPotentialPresetBuffs(singleBuild, presetRoster, {
          levelOverrides: { [`${slotKey}:${pot.id}`]: lvl },
          potentialLookup: potLookup,
        })
          .filter((b) => b.enabled)
          .map((b) => ({
            target: b.target,
            stat: b.stat,
            value: b.value,
            ...(b.realisticUptime !== undefined ? { realisticUptime: b.realisticUptime } : {}),
          }));
      };

      for (const sel of slotData.potentials) {
        const pot = potLookup(cid, sel.id);
        if (!pot) continue;
        slotPotsForSynth.push({ pot, level: Math.max(1, Math.round(Number(sel.level) || 6)) });

        if (pot.isCore) {
          corePotentialBuffs.push(...extractSinglePotAtLevel(pot, 1));
          continue;
        }

        const maxLevel = getPotentialTierCap(pot);
        const presetLevel = Math.min(maxLevel, Math.max(1, Math.round(Number(sel.level) || 6)));
        const presetPlus3 = Math.min(maxLevel, presetLevel + 3);
        const lv6 = Math.min(maxLevel, 6);
        const lv9 = Math.min(maxLevel, 9);

        const buffsAtPreset = extractSinglePotAtLevel(pot, presetLevel);
        const buffsAtPresetPlus3 =
          presetPlus3 === presetLevel ? buffsAtPreset : extractSinglePotAtLevel(pot, presetPlus3);
        const buffsAtLv6 = lv6 === presetLevel ? buffsAtPreset : extractSinglePotAtLevel(pot, lv6);
        const buffsAtLv9 = lv9 === presetPlus3 ? buffsAtPresetPlus3 : extractSinglePotAtLevel(pot, lv9);

        const extraHitsAtPreset = extractPotentialExtraHitSpecs(
          renderPotentialAtLevel(pot.descTemplate, pot.params, presetLevel),
          defaultScaling
        );
        const extraHitsAtPresetPlus3 =
          presetPlus3 === presetLevel
            ? extraHitsAtPreset
            : extractPotentialExtraHitSpecs(
                renderPotentialAtLevel(pot.descTemplate, pot.params, presetPlus3),
                defaultScaling
              );
        const extraHitsAtLv6 =
          lv6 === presetLevel
            ? extraHitsAtPreset
            : extractPotentialExtraHitSpecs(
                renderPotentialAtLevel(pot.descTemplate, pot.params, lv6),
                defaultScaling
              );
        const extraHitsAtLv9 =
          lv9 === presetPlus3
            ? extraHitsAtPresetPlus3
            : extractPotentialExtraHitSpecs(
                renderPotentialAtLevel(pot.descTemplate, pot.params, lv9),
                defaultScaling
              );

        const hasBuffs =
          buffsAtPreset.length > 0 ||
          buffsAtPresetPlus3.length > 0 ||
          buffsAtLv6.length > 0 ||
          buffsAtLv9.length > 0;
        const hasExtraHits =
          extraHitsAtPreset.length > 0 ||
          extraHitsAtPresetPlus3.length > 0 ||
          extraHitsAtLv6.length > 0 ||
          extraHitsAtLv9.length > 0;

        const kind: SlicedPotentialEntry['kind'] =
          hasBuffs && hasExtraHits
            ? 'hybrid'
            : hasBuffs
              ? 'stat'
              : hasExtraHits
                ? 'proc'
                : 'mechanic';

        potentials.push({
          potentialId: pot.id,
          slot: slotKey,
          characterId: cid,
          characterName: charName,
          name: pot.name,
          rarity: pot.rarity,
          presetLevel,
          maxLevel,
          kind,
          buffsAtPreset,
          buffsAtPresetPlus3,
          buffsAtLv6,
          buffsAtLv9,
          extraHitsAtPreset,
          extraHitsAtPresetPlus3,
          extraHitsAtLv6,
          extraHitsAtLv9,
        });
      }
    }

    if (r.combat && fullCombat) {
      const activeDescs = [
        ...(slotKey === 'vanguard'
          ? [fullCombat.normalAtk?.desc, fullCombat.skill?.desc, fullCombat.ultimate?.desc]
          : [fullCombat.supportSkill?.desc, fullCombat.ultimate?.desc]),
        ...slotPotsForSynth.map((x) => x.pot.descTemplate),
      ].filter((d): d is string => Boolean(d));
      const triggers: ElementType[] = [];
      const inflicts: ElementType[] = [];
      for (const el of ELEMENTS) {
        const trigRe = new RegExp(`\\btrigger(?:s|ing)?\\s+(?:##)?${el}\\s*Mark\\b`, 'i');
        const inflictRe = new RegExp(`\\binflict(?:s|ing)?\\s+(?:a\\s+)?(?:##)?${el}\\s*Mark\\b`, 'i');
        if (activeDescs.some((d) => trigRe.test(d))) triggers.push(el);
        if (activeDescs.some((d) => inflictRe.test(d))) inflicts.push(el);
      }
      if (triggers.length > 0) r.combat.triggersMarkElements = triggers;
      if (inflicts.length > 0) r.combat.inflictsMarkElements = inflicts;
    }

    synthRoster.push({
      slot: slotKey,
      character: r.character,
      combat: fullCombat,
      potentials: slotPotsForSynth,
    });
  }

  // Slice candidate discs: same-element 4★/5★, cross-element generic-stat 5★, neutral 4★, & equipped discs
  const candidateDiscs: Record<string, SSDisc> = {};
  const equippedIds = new Set<number>(preset.allDiscIds);

  for (const disc of Object.values(allDiscs)) {
    const isEquipped = equippedIds.has(disc.id);
    const isSameElement = disc.element === preset.element && disc.star >= 4;
    const isGenericCross = disc.star === 5 && hasGenericSecondaryStat(disc);
    if (isEquipped || isSameElement || isGenericCross) {
      candidateDiscs[String(disc.id)] = disc;
    }
  }

  const { profile: autoProfile, summary: profileSummary } = synthesizeCombatProfile({
    roster: synthRoster,
    mainDiscs: preset.advData.mainDiscs,
    targetNotes: preset.advData.targetNotes,
    discsLookup: allDiscs,
    archetype: preset.archetype,
  });

  const hasCustomRotation = hasActiveRotationEntries(preset.combatRotation);
  const profile = hasCustomRotation
    ? deriveProfileFromRotation(preset.combatRotation!, roster)
    : autoProfile;

  return {
    presetId: preset.id,
    element: preset.element,
    archetype: preset.archetype,
    mainDiscs: preset.advData.mainDiscs.map((m) => ({ ...m, level: 90 })),
    supportDiscs: preset.advData.supportDiscs.map((s) => ({ ...s, level: 90 })),
    targetNotes: { ...preset.advData.targetNotes },
    roster,
    basePotentialBuffs,
    corePotentialBuffs,
    ...(baseSkillBuffs.length > 0 ? { baseSkillBuffs } : {}),
    potentials,
    skillLv3Ratios,
    ...(Object.keys(skillLv3BuffPairs).length > 0 ? { skillLv3BuffPairs } : {}),
    candidateDiscs,
    profile,
    profileSummary,
    ...(Object.keys(parsedSkillsBySlot).length > 0 ? { parsedSkillsBySlot } : {}),
    ...(hasCustomRotation ? { combatRotation: preset.combatRotation! } : {}),
  };
}

