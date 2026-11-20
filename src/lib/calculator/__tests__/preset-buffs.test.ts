import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import {
  extractDiscPresetBuffs,
  extractPotentialPresetBuffs,
  getHarmonyActiveLevel,
  type PresetBuffRosterSlot,
} from '../preset-buffs.ts';
import { computePresetContributions } from '../damage-engine.ts';
import {
  calculateTeam,
  type CharacterCombatEntry,
  type FighterInput,
} from '../fighter-calc.ts';
import type {
  AdvancedTeamBuild,
  NoteName,
  SSCharacter,
  SSDisc,
  SelectedPotential,
} from '../../../types/index.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
const discs = discsData as unknown as Record<string, SSDisc>;

function makeEmptyBuild(): AdvancedTeamBuild {
  const emptyPotentials: SelectedPotential[] = [];
  return {
    id: 'test-build',
    name: 'Test Build',
    createdAt: 0,
    slots: {
      vanguard: { characterId: null, potentials: [...emptyPotentials] },
      versatile: { characterId: null, potentials: [...emptyPotentials] },
      support: { characterId: null, potentials: [...emptyPotentials] },
    },
    mainDiscs: [
      { discId: null, level: 80, crescendo: 1 },
      { discId: null, level: 80, crescendo: 1 },
      { discId: null, level: 80, crescendo: 1 },
    ],
    supportDiscs: [
      { discId: null, phase: 8, level: 80 },
      { discId: null, phase: 8, level: 80 },
      { discId: null, phase: 8, level: 80 },
    ],
    targetNotes: {},
  };
}

describe('Phase 2 preset-buffs disc & potential auto-importer', () => {
  it('scales Disc Melody by crescendo (C1 vs C6), maps ATK+Minions to atkPctPerma, and skips defensive armor', () => {
    const snowishLaru = characters['158']; // Ignis Versatile
    const firenze = characters['110']; // Umbra Vanguard
    const tilia = characters['107']; // Lux Support

    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: firenze },
      { slot: 'versatile', character: snowishLaru },
      { slot: 'support', character: tilia },
    ];

    const c1 = extractDiscPresetBuffs(
      [{ discId: 214001, level: 80, crescendo: 1 }],
      {},
      discs,
      roster
    );
    const c6 = extractDiscPresetBuffs(
      [{ discId: 214001, level: 80, crescendo: 6 }],
      {},
      discs,
      roster
    );

    const ignisDmgC1 = c1.find((b) => b.origin === 'melody' && b.stat === 'elementDmg');
    const ignisDmgC6 = c6.find((b) => b.origin === 'melody' && b.stat === 'elementDmg');
    assert.ok(ignisDmgC1 && ignisDmgC6);
    assert.equal(ignisDmgC1.value, 10);
    assert.equal(ignisDmgC6.value, 20);
    // Only the Ignis slot receives Ignis-scoped squad buffs
    assert.equal(ignisDmgC6.target, 'versatile');

    const atkPerma = c6.find((b) => b.origin === 'melody' && b.stat === 'atkPctPerma');
    assert.ok(atkPerma, 'Expected ATK + Minions clause to emit atkPctPerma');
    assert.equal(atkPerma.value, 5);
    assert.equal(atkPerma.target, 'versatile');

    // "Blazing Armor: Reduces DMG taken by 10%" should not produce a damage buff
    assert.ok(!c6.some((b) => b.description.toLowerCase().includes('blazing armor: reduces dmg taken')));
  });

  it('gates Disc Harmony skills by Musical Note thresholds and ignores Support Disc skills', () => {
    const firenze = characters['110'];
    const freesia = characters['125'];
    const teresa = characters['127'];

    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: firenze },
      { slot: 'versatile', character: freesia },
      { slot: 'support', character: teresa },
    ];

    // Seasonal Waves sec1 (Drowsy Delights) requires 10/25/40/55/70 of Pummel/Skill/Ultimate
    const disc = discs['213002'];
    assert.equal(getHarmonyActiveLevel(disc.secondarySkill1?.requirements, {}), 0);
    assert.equal(
      getHarmonyActiveLevel(disc.secondarySkill1?.requirements, {
        'Melody of Pummel': 25,
        'Melody of Skill': 25,
        'Melody of Ultimate': 25,
      }),
      2
    );
    assert.equal(
      getHarmonyActiveLevel(disc.secondarySkill1?.requirements, {
        'Melody of Pummel': 70,
        'Melody of Skill': 70,
        'Melody of Ultimate': 70,
      }),
      5
    );

    const lockedBuffs = extractDiscPresetBuffs(
      [{ discId: 213002, level: 80, crescendo: 1 }],
      { 'Melody of Pummel': 0 },
      discs,
      roster
    );
    assert.equal(
      lockedBuffs.filter((b) => b.origin === 'harmony').length,
      0,
      'Harmony buffs must not activate at 0 notes'
    );

    const lv2Buffs = extractDiscPresetBuffs(
      [{ discId: 213002, level: 80, crescendo: 1 }],
      {
        'Melody of Pummel': 25,
        'Melody of Skill': 25,
        'Melody of Ultimate': 25,
      },
      discs,
      roster
    );
    const skillLv2 = lv2Buffs.find((b) => b.origin === 'harmony' && b.stat === 'skillDmg');
    assert.ok(skillLv2);
    assert.equal(skillLv2.harmonyLevel, 2);
    assert.equal(skillLv2.value, 6);
    assert.equal(skillLv2.target, 'vanguard');

    // Support Trekkers' ATK on generic 4-star disc targets assist slots (versatile & support)
    const supportAtkTargets = lv2Buffs
      .filter((b) => b.origin === 'melody' && b.stat === 'atkPct')
      .map((b) => b.target)
      .sort();
    assert.deepEqual(supportAtkTargets, ['support', 'versatile']);
  });

  it('excludes element-scoped buffs when 0 matching Trekkers exist on the roster', () => {
    const firenze = characters['110']; // Umbra
    const freesia = characters['125']; // Aqua
    const teresa = characters['127']; // Aqua

    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: firenze },
      { slot: 'versatile', character: freesia },
      { slot: 'support', character: teresa },
    ];

    // Meowing Cat God only buffs Ignis Trekkers -> 0 Ignis on roster => 0 buffs emitted
    const buffs = extractDiscPresetBuffs(
      [{ discId: 214001, level: 80, crescendo: 6 }],
      { 'Melody of Burst': 70, 'Melody of Skill': 70 },
      discs,
      roster
    );
    assert.equal(buffs.length, 0);
  });

  it('extracts Potentials at default Lv.6, applies Lv.90 +1..+3 Emblem offsets capped at tier 9, and keeps Core at Lv.1', () => {
    const chitose = characters['144']; // Aqua Vanguard
    const freesia = characters['125']; // Aqua Versatile
    const tilia = characters['107']; // Lux Support

    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: chitose },
      { slot: 'versatile', character: freesia },
      { slot: 'support', character: tilia },
    ];

    const build = makeEmptyBuild();
    build.slots.support = {
      characterId: 107,
      potentials: [
        { id: 510701, rarity: 0, level: 1 }, // Shield Counter (Core): -110 DEF reduction
        { id: 510703, rarity: 0, level: 1 }, // Unity of Offense and Defense (Core): 3.2% x 10 = 32% Lux DMG Taken
        { id: 510733, rarity: 1, level: 6 }, // Banner of Glory (non-core): DEF +211 at Lv.6, +290 at Lv.9
      ],
    };

    const basePots = extractPotentialPresetBuffs(build, roster);
    const defRed = basePots.find((b) => b.potentialId === 510701 && b.stat === 'defReduction');
    assert.ok(defRed);
    assert.equal(defRed.value, 110);
    assert.equal(defRed.target, 'team');

    const luxTaken = basePots.find((b) => b.potentialId === 510703 && b.stat === 'elementTaken');
    assert.ok(luxTaken);
    assert.equal(luxTaken.stacks, 10);
    assert.equal(luxTaken.value, 32);

    const bannerLv6 = basePots.find((b) => b.potentialId === 510733 && b.stat === 'baseDef');
    assert.ok(bannerLv6);
    assert.equal(bannerLv6.level, 6);
    assert.equal(bannerLv6.value, 211);
    assert.equal(bannerLv6.target, 'vanguard');

    // Apply Lv.90 +3 Emblem Potential offset -> effective level 6 + 3 = 9
    const boostedPots = extractPotentialPresetBuffs(build, roster, {
      bonusLevels: { 'support:510733': 3, 'support:510701': 3 },
    });
    const bannerLv9 = boostedPots.find((b) => b.potentialId === 510733 && b.stat === 'baseDef');
    assert.ok(bannerLv9);
    assert.equal(bannerLv9.emblemBonusLevel, 3);
    assert.equal(bannerLv9.value, 290);

    // Core potential stays fixed at Lv.1 even if bonus requested
    const coreAfter = boostedPots.find((b) => b.potentialId === 510701 && b.stat === 'defReduction');
    assert.ok(coreAfter);
    assert.equal(coreAfter.emblemBonusLevel, 0);
    assert.equal(coreAfter.level, 1);
  });

  it('increases calculateTeam damage output when auto-imported Disc & Potential buffs are fed into TeamCalcInput', () => {
    const chitose = characters['144'];
    const freesia = characters['125'];
    const tilia = characters['107'];

    const build = makeEmptyBuild();
    build.slots.vanguard = { characterId: 144, potentials: [] };
    build.slots.versatile = { characterId: 125, potentials: [] };
    build.slots.support = {
      characterId: 107,
      potentials: [{ id: 510704, rarity: 0, level: 1 }], // Holy Domain: 6% x 4 = 24% Skill DMG Taken
    };
    build.mainDiscs[0] = { discId: 211001, level: 80, crescendo: 6 }; // Crisp Morning: +14% Main ATK
    build.mainDiscs[1] = { discId: 213002, level: 80, crescendo: 6 }; // Seasonal Waves
    build.supportDiscs[0] = { discId: 214001, phase: 8, level: 80, crescendo: 6 }; // Ignored for Melody/Harmony

    const notes: Partial<Record<NoteName, number>> = {
      'Melody of Pummel': 70,
      'Melody of Skill': 70,
      'Melody of Ultimate': 70,
    };

    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: chitose },
      { slot: 'versatile', character: freesia },
      { slot: 'support', character: tilia },
    ];

    const imported = [
      ...extractDiscPresetBuffs(build.mainDiscs, notes, discs, roster),
      ...extractPotentialPresetBuffs(build, roster),
    ].filter((b) => b.enabled);

    assert.ok(imported.length > 0);

    const contributions = computePresetContributions(
      build.mainDiscs,
      build.supportDiscs,
      notes,
      discs
    );

    const emptyEmblems = { '70': [], '80': [], '90': [] };
    const fighters: FighterInput[] = [
      {
        state: {
          slot: 'vanguard',
          level: '90',
          skillLevel: 10,
          affinityLevel: 10,
          talentTier: 0,
          emblems: emptyEmblems,
          rotation: [
            {
              id: 'skill-1',
              source: 'skill',
              name: 'Test Skill',
              motionValuePct: 200,
              hits: 1,
              casts: 1,
              damageType: 'Skill',
              scalingStat: 'ATK',
            },
          ],
        },
        character: chitose,
        combat: combatDb['144'] ?? null,
      },
    ];

    const withoutBuffs = calculateTeam({
      fighters,
      contributions,
      buffs: [],
      recordLevel: 31,
      enemy: { def: 500, res: 250, resilienceBroken: false },
    });

    const withBuffs = calculateTeam({
      fighters,
      contributions,
      buffs: imported.map((b) => ({ target: b.target, stat: b.stat, value: b.value })),
      recordLevel: 31,
      enemy: { def: 500, res: 250, resilienceBroken: false },
    });

    assert.ok(
      withBuffs.totalExpected > withoutBuffs.totalExpected * 1.3,
      `Expected auto-imported buffs to raise damage substantially (${withoutBuffs.totalExpected} -> ${withBuffs.totalExpected})`
    );
  });
});
