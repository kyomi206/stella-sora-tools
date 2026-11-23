import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import communityPresetsData from '../../../data/community-presets.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import potentialsDbData from '../../../data/potentials-db.json' with { type: 'json' };
import {
  resolveCommunityPreset,
  type CommunityPresetEntry,
  type ResolvedCommunityPreset,
} from '../../community-presets.ts';
import type { SSCharacter, SSDisc, SSPotentialFull } from '../../../types/index.ts';
import type { CharacterCombatEntry, SlotKey } from '../fighter-calc.ts';
import { synthesizeCombatProfile } from '../combat-profile-synthesizer.ts';
import {
  buildDiscRankingContext,
  buildFighters,
  computeEstimatedDiscRankings,
  inferSquadElement,
} from '../disc-rankings.ts';
import type { BuildRotation } from '../build-rotation.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
const discs = discsData as unknown as Record<string, SSDisc>;
const potentialsDb = potentialsDbData as unknown as Record<string, SSPotentialFull[]>;
const presets = (communityPresetsData as unknown as CommunityPresetEntry[])
  .map((e) => resolveCommunityPreset(e))
  .filter((p): p is ResolvedCommunityPreset => p !== null);

function synthesizeForPreset(presetId: string) {
  const preset = presets.find((p) => p.id === presetId);
  assert.ok(preset, `Preset ${presetId} not found`);

  const roster = (['vanguard', 'versatile', 'support'] as const).map((slot) => {
    const slotData = preset.advData.slots[slot];
    const cid = slotData?.characterId ?? null;
    const character = cid ? characters[String(cid)] ?? null : null;
    const combat = cid ? combatDb[String(cid)] ?? null : null;
    const charPots = cid ? potentialsDb[String(cid)] ?? [] : [];
    const potentials = (slotData?.potentials ?? [])
      .map((sel) => {
        const pot = charPots.find((p) => p.id === sel.id);
        return pot ? { pot, level: Number(sel.level) || 6 } : null;
      })
      .filter((x): x is { pot: SSPotentialFull; level: number } => x !== null);

    return { slot, character, combat, potentials };
  });

  return synthesizeCombatProfile({
    roster,
    mainDiscs: preset.advData.mainDiscs,
    targetNotes: preset.advData.targetNotes,
    discsLookup: discs,
    archetype: undefined,
  });
}

describe('combat-profile-synthesizer (zero hardcoding)', () => {
  it('classifies all 14 reference builds accurately without archetype metadata', () => {
    const expectations: Array<{
      id: string;
      carrySlot: SlotKey;
      carryTypeStat: string;
    }> = [
      { id: 'gerie-mark-leafia', carrySlot: 'versatile', carryTypeStat: 'markDmg' },
      { id: 'gerie-mark-tilia', carrySlot: 'versatile', carryTypeStat: 'markDmg' },
      { id: 'eleanor-skill-willow', carrySlot: 'versatile', carryTypeStat: 'skillDmg' },
      { id: 'otoha-dps-mistique', carrySlot: 'versatile', carryTypeStat: 'skillDmg' },
      { id: 'firstlight-noya-skill', carrySlot: 'vanguard', carryTypeStat: 'skillDmg' },
      { id: 'firstlight-noya-aa', carrySlot: 'vanguard', carryTypeStat: 'aaDmg' },
      { id: 'karin-ultimate-umbra', carrySlot: 'vanguard', carryTypeStat: 'ultDmg' },
      { id: 'karin-aa-umbra', carrySlot: 'vanguard', carryTypeStat: 'aaDmg' },
      { id: 'fuyuka-ultimate-slaru', carrySlot: 'vanguard', carryTypeStat: 'ultDmg' },
      { id: 'allie-mark-teresa', carrySlot: 'vanguard', carryTypeStat: 'markDmg' },
      { id: 'chitose-mark-willow', carrySlot: 'vanguard', carryTypeStat: 'markDmg' },
      { id: 'wraith-aa-eleanor', carrySlot: 'vanguard', carryTypeStat: 'aaDmg' },
      // Eleanor (versatile) is the sole 5★ AA carry alongside 4★ Canace driver & 4★ Ann buffer
      { id: 'eleanor-aa-canace', carrySlot: 'versatile', carryTypeStat: 'aaDmg' },
      { id: 'sparkla-jaw-terra', carrySlot: 'vanguard', carryTypeStat: 'skillDmg' },
    ];

    for (const exp of expectations) {
      const { profile, summary } = synthesizeForPreset(exp.id);
      assert.equal(
        profile.carrySlot,
        exp.carrySlot,
        `${exp.id}: expected carrySlot ${exp.carrySlot}, got ${profile.carrySlot}`
      );
      assert.equal(
        profile.carryTypeStat,
        exp.carryTypeStat,
        `${exp.id}: expected carryTypeStat ${exp.carryTypeStat}, got ${profile.carryTypeStat}`
      );
      const totalShare = summary.slots.reduce((acc, s) => acc + s.sharePct, 0);
      assert.ok(
        Math.abs(totalShare - 100) <= 1,
        `${exp.id}: expected summary sharePct sum ~100, got ${totalShare}`
      );
    }
  });

  it('guards against Suntide Willow 1s CD in eleanor-skill-willow', () => {
    const { summary } = synthesizeForPreset('eleanor-skill-willow');
    const vanguard = summary.slots.find((s) => s.slot === 'vanguard')!;
    const versatile = summary.slots.find((s) => s.slot === 'versatile')!;
    assert.ok(
      vanguard.sharePct < 15,
      `Expected Suntide Willow vanguard share < 15%, got ${vanguard.sharePct}%`
    );
    assert.ok(
      versatile.sharePct > 60,
      `Expected Eleanor versatile share > 60%, got ${versatile.sharePct}%`
    );
  });

  it('handles partial/empty 1-Trekker squad with empty discs & notes', () => {
    const firstChar = Object.values(characters)[0];
    const firstCombat = combatDb[String(firstChar.id)] ?? null;
    const { profile, summary } = synthesizeCombatProfile({
      roster: [
        { slot: 'vanguard', character: firstChar, combat: firstCombat, potentials: [] },
        { slot: 'versatile', character: null, combat: null, potentials: [] },
        { slot: 'support', character: null, combat: null, potentials: [] },
      ],
      mainDiscs: [],
      targetNotes: {},
      discsLookup: discs,
    });

    assert.equal(profile.carrySlot, 'vanguard');
    const slices = profile.slots.vanguard ?? [];
    assert.ok(slices.length > 0);
    for (const s of slices) {
      assert.ok(Number.isFinite(s.weight) && s.weight > 0);
    }
    const shareSum = summary.slots.reduce((acc, s) => acc + s.sharePct, 0);
    assert.equal(shareSum, 100);
  });

  it('switches buildFighters & rankings deterministically when combatRotation is provided', () => {
    const preset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const autoCtx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const autoEst = computeEstimatedDiscRankings(autoCtx);

    const customRotation: BuildRotation = {
      version: 1,
      label: 'Custom AA Vanguard Test',
      slots: {
        vanguard: [
          {
            id: 'willow-aa',
            source: 'normalAtk',
            name: 'Willow AA',
            damageType: 'Auto Attack',
            scalingStat: 'ATK',
            motionValuePct: 5000,
            hits: 1,
            casts: 5,
          },
        ],
        versatile: [
          {
            id: 'eleanor-sk',
            source: 'supportSkill',
            name: 'Eleanor Skill',
            damageType: 'Skill',
            scalingStat: 'HP',
            motionValuePct: 50,
            hits: 1,
            casts: 1,
          },
        ],
      },
    };

    const customPreset: ResolvedCommunityPreset = {
      ...preset,
      combatRotation: customRotation,
    };
    const customCtx = buildDiscRankingContext(customPreset, characters, combatDb, discs, potentialsDb);
    assert.equal(customCtx.profile.carrySlot, 'vanguard');
    assert.equal(customCtx.profile.carryTypeStat, 'aaDmg');

    const fighters = buildFighters(customCtx);
    assert.equal(fighters[0].state.rotation.length, 1);
    assert.equal(fighters[0].state.rotation[0].motionValuePct, 5000);
    assert.equal(fighters[0].state.rotation[0].casts, 5);

    const customEst = computeEstimatedDiscRankings(customCtx);
    assert.notDeepEqual(
      customEst.main.slice(0, 3).map((r) => `${r.discId}:${r.dupe}`),
      autoEst.main.slice(0, 3).map((r) => `${r.discId}:${r.dupe}`)
    );
  });

  it('deduplicates topTypes, preserves Slot-3 offensive shares, and infers off-field squad element cleanly', () => {
    for (const p of presets) {
      const { summary } = synthesizeForPreset(p.id);
      for (const slotSummary of summary.slots) {
        assert.equal(
          new Set(slotSummary.topTypes).size,
          slotSummary.topTypes.length,
          `${p.id} ${slotSummary.slot}: duplicate entries in topTypes`
        );
      }
    }

    const otohaMistique = synthesizeForPreset('otoha-dps-mistique').summary;
    const mistique = otohaMistique.slots.find((s) => s.slot === 'support');
    assert.ok(
      mistique && mistique.sharePct >= 8,
      `Expected Slot-3 offensive Versatile (Mistique) share >= 8%, got ${mistique?.sharePct}%`
    );

    const karinCosette = synthesizeForPreset('karin-ultimate-umbra').summary;
    const cosette = karinCosette.slots.find((s) => s.slot === 'support');
    assert.ok(
      cosette && cosette.sharePct < 5,
      `Expected Slot-3 pure Support (Cosette) share < 5%, got ${cosette?.sharePct}%`
    );

    const willowPreset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    assert.equal(inferSquadElement(willowPreset.advData, characters, discs), 'Ventus');
    assert.equal(
      inferSquadElement(
        {
          slots: {
            vanguard: { characterId: null, potentials: [] },
            versatile: willowPreset.advData.slots.versatile,
            support: { characterId: null, potentials: [] },
          },
          mainDiscs: [
            { discId: null, crescendo: 1, level: 90 },
            { discId: null, crescendo: 1, level: 90 },
            { discId: null, crescendo: 1, level: 90 },
          ],
        },
        characters,
        discs
      ),
      'Ventus'
    );
  });
});
