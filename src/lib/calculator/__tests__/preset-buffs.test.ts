import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import potentialsDbData from '../../../data/potentials-db.json' with { type: 'json' };
import {
  estimatePotentialRealisticUptime,
  extractDiscPresetBuffs,
  extractEffectsFromText,
  extractPotentialExtraHitSpecs,
  extractPotentialPresetBuffs,
  extractSkillKitPresetBuffs,
  getHarmonyActiveLevel,
  isPotentialSquadConditionBlocked,
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
  SSPotentialFull,
  SelectedPotential,
} from '../../../types/index.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
const discs = discsData as unknown as Record<string, SSDisc>;
const potentialsDb = potentialsDbData as unknown as Record<string, SSPotentialFull[]>;
const potLookup = (cid: number | null, pid: number) =>
  cid ? potentialsDb[String(cid)]?.find((p) => p.id === pid) : undefined;

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

  it('extracts extra-hit MV specs from potential descriptions', () => {
    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'Glows fired by Firstlight Noya return to hit targets, dealing 63% of Max HP as Lux Skill DMG.'
      ),
      [{ mvPct: 63, hits: 1, scalingStat: 'HP', damageType: 'Skill' }]
    );

    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'When casting the longsword form Empyrean Starender (Ultimate), fires 7 Glows that each deal 120%of Max HP as Lux Skill DMG.'
      ),
      [{ mvPct: 120, hits: 7, scalingStat: 'HP', damageType: 'Skill' }]
    );

    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'Each Avalanche deals 34% x2 of ATK as AoE Lux Skill DMG and inflicts Lux Mark: Radiance.'
      ),
      [{ mvPct: 34, hits: 2, scalingStat: 'ATK', damageType: 'Skill' }]
    );

    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'After Karin deals Ultimate DMG 5 times, Boss Shark follows up with a tail strike, dealing 652% of ATK as AoE Umbra Ultimate DMG and triggering Umbra Mark.'
      ),
      [{ mvPct: 652, hits: 1, scalingStat: 'ATK', damageType: 'Ultimate' }]
    );

    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'Reduces the intervals between each summon of a Lanterna Phantom by 30%.'
      ),
      []
    );
  });

  it('extracts Guiding Star, Jubilant Spin, per-element squad multipliers, and trailing stack caps', () => {
    // 1. Guiding Star
    const guiding = extractEffectsFromText(
      'While in the Starender state, Noya gains 60% additional Crit DMG and restores 2.5 Energy every 1s.',
      'own'
    );
    assert.ok(
      guiding.some((e) => e.targetHint === 'own' && e.stat === 'critDmg' && e.value === 60),
      `Expected Guiding Star critDmg=60 own, got ${JSON.stringify(guiding)}`
    );

    // 2. Jubilant Spin
    const jubilant = extractEffectsFromText(
      "After the penguin statue from the raffle appears, Nazuna unleashes a barrage and the main Trekker's Skill DMG is increased by 53% for 7s.",
      'own'
    );
    assert.ok(
      jubilant.some((e) => e.targetHint === 'main' && e.stat === 'skillDmg' && e.value === 53),
      `Expected Jubilant Spin skillDmg=53 main, got ${JSON.stringify(jubilant)}`
    );

    // 3. Murmur of Annihilation (3-Umbra squad -> 13% x 3 = 39% Umbra DMG to all Umbra teammates)
    const umbraRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['157'] }, // Karin (Umbra)
      { slot: 'versatile', character: characters['145'] }, // Otoha (Umbra)
      { slot: 'support', character: characters['142'] }, // Cosette (Umbra)
    ];
    const umbraBuild = makeEmptyBuild();
    umbraBuild.slots.vanguard = { characterId: 157, potentials: [] };
    umbraBuild.slots.versatile = {
      characterId: 145,
      potentials: [{ id: 514532, rarity: 2, level: 6 }],
    };
    umbraBuild.slots.support = { characterId: 142, potentials: [] };
    const murmurBuffs = extractPotentialPresetBuffs(umbraBuild, umbraRoster);
    assert.ok(
      murmurBuffs.some(
        (b) => b.potentialId === 514532 && b.stat === 'elementDmg' && b.value === 39 && b.target === 'team'
      ),
      `Expected Murmur of Annihilation 39% Umbra DMG targeting team, got ${JSON.stringify(murmurBuffs)}`
    );

    // 4. Astral Brilliance (3-Lux squad -> 35 x 3 = 105 Lux PEN on Firstlight Noya)
    const luxRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['162'] }, // Firstlight Noya (Lux)
      { slot: 'versatile', character: characters['115'] }, // Firefly (Lux)
      { slot: 'support', character: characters['107'] }, // Tilia (Lux)
    ];
    const luxBuild = makeEmptyBuild();
    luxBuild.slots.vanguard = {
      characterId: 162,
      potentials: [{ id: 516212, rarity: 2, level: 6 }],
    };
    luxBuild.slots.versatile = { characterId: 115, potentials: [] };
    luxBuild.slots.support = { characterId: 107, potentials: [] };
    const astralBuffs = extractPotentialPresetBuffs(luxBuild, luxRoster);
    assert.ok(
      astralBuffs.some(
        (b) => b.potentialId === 516212 && b.target === 'vanguard' && b.stat === 'resPen' && b.value === 105
      ),
      `Expected Astral Brilliance vanguard:resPen=105, got ${JSON.stringify(astralBuffs)}`
    );

    // 5. Anima Resonance (3-Terra squad -> 20% x 3 = 60% ATK on Gerie)
    const terraRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['149'] }, // Gerie (Terra)
      { slot: 'versatile', character: characters['161'] }, // Leafia (Terra)
      { slot: 'support', character: characters['156'] }, // Nazuna (Terra)
    ];
    const terraBuild = makeEmptyBuild();
    terraBuild.slots.versatile = {
      characterId: 149,
      potentials: [{ id: 514933, rarity: 2, level: 6 }],
    };
    // Match role slot of Gerie (vanguard) or versatile — test versatile slot for Gerie as in community builds
    const gerieVersatileRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['161'] },
      { slot: 'versatile', character: characters['149'] },
      { slot: 'support', character: characters['156'] },
    ];
    const animaBuffs = extractPotentialPresetBuffs(terraBuild, gerieVersatileRoster);
    assert.ok(
      animaBuffs.some(
        (b) => b.potentialId === 514933 && b.target === 'versatile' && b.stat === 'atkPct' && b.value === 60
      ),
      `Expected Anima Resonance versatile:atkPct=60, got ${JSON.stringify(animaBuffs)}`
    );

    // 6. Touch 'n' Bounce trailing stack cap (5% x 8 = 40% squad Skill DMG)
    const touchBounce = extractEffectsFromText(
      "Each time Bubble Frog bounces, increases the squad's Skill DMG by 5%. Additionally, increases non-Aqua Squadmates' Skill DMG by 7%. This effect lasts 2.5s, stacking up to 8 times.",
      'own'
    );
    assert.ok(
      touchBounce.some((e) => e.targetHint === 'squad' && e.stat === 'skillDmg' && e.value === 40 && e.stacks === 8),
      `Expected Touch 'n' Bounce squad skillDmg=40 (8 stacks), got ${JSON.stringify(touchBounce)}`
    );
  });

  it('extracts Brilliant Relay, Engulfing Tide, Hovering Gale, and Solitary Lantern correctly', () => {
    // Brilliant Relay -> main -> vanguard
    const brilliantEffects = extractEffectsFromText(
      'When Aegis of Light reaches the main Trekker, increases their ATK by 15% for 15s, up to 4 stacks.',
      'own'
    );
    assert.ok(
      brilliantEffects.some((e) => e.targetHint === 'main' && e.stat === 'atkPct' && e.value === 60),
      `Expected Brilliant Relay targetHint=main atkPct=60, got ${JSON.stringify(brilliantEffects)}`
    );

    const relayRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['144'] },
      { slot: 'versatile', character: characters['107'] },
      { slot: 'support', character: characters['160'] },
    ];
    const relayBuild = makeEmptyBuild();
    relayBuild.slots.vanguard = { characterId: 144, potentials: [] };
    relayBuild.slots.versatile = {
      characterId: 107,
      potentials: [{ id: 510728, rarity: 2, level: 6 }],
    };
    relayBuild.slots.support = {
      characterId: 160,
      potentials: [{ id: 516028, rarity: 2, level: 6 }],
    };
    const relayBuffs = extractPotentialPresetBuffs(relayBuild, relayRoster);
    assert.ok(
      relayBuffs.some(
        (b) => b.potentialId === 510728 && b.target === 'vanguard' && b.stat === 'atkPct' && b.value === 60
      ),
      `Expected Brilliant Relay vanguard:atkPct=60, got ${JSON.stringify(relayBuffs)}`
    );
    assert.ok(
      relayBuffs.some(
        (b) => b.potentialId === 516028 && b.target === 'vanguard' && b.stat === 'elementDmg' && b.value === 70
      ),
      `Expected Engulfing Tide vanguard:elementDmg=70, got ${JSON.stringify(relayBuffs)}`
    );

    // Hovering Gale extra-hit
    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'When a target with Smiling Sanction has Aqua Mark triggered, this target is immediately inflicted with Aqua Mark: Torrent again and receives an additional 474% of ATK as Aqua Mark DMG.'
      ),
      [{ mvPct: 474, hits: 1, scalingStat: 'ATK', damageType: 'Mark' }]
    );

    // Solitary Lantern extra-hit ("shoot 3 times, each dealing 244% of ATK")
    assert.deepEqual(
      extractPotentialExtraHitSpecs(
        'When Otoha deals Ultimate DMG, there is a 80% chance to shoot 3 times, each dealing 244% of ATK as AoE Umbra Ultimate DMG.'
      ),
      [{ mvPct: 244, hits: 3, scalingStat: 'ATK', damageType: 'Ultimate' }]
    );
  });

  it('fixes all 6 parser bugs: Mark DMG Multiplier, non-Element negation, DMG Taken of all Elements, compound inheritance, Leyline Amp, Peak Performance', () => {
    // 1. Touch of Nature: Mark DMG Multiplier -> markDmg (not skillIntensity)
    const touchOfNature = extractEffectsFromText(
      "Increases Nazuna's Terra Mark DMG Multiplier by 420%.",
      'own'
    );
    assert.equal(touchOfNature[0]?.stat, 'markDmg');
    assert.equal(touchOfNature[0]?.value, 420);

    // 2. Foam Echo: own and non-Aqua Squadmates' ATK -> team on S.Willow + Eleanor + Nazuka
    const willowRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: characters['163'] ?? characters['108'] }, // Eleanor (Ventus)
      { slot: 'versatile', character: characters['164'] ?? characters['159'] }, // Nazuka (Ventus)
      { slot: 'support', character: characters['165'] ?? characters['160'] }, // S.Willow (Aqua)
    ];
    const sWillowChar = Object.values(characters).find((c) => c.name.EN === 'Suntide Willow');
    const eleanorChar = Object.values(characters).find((c) => c.name.EN === 'Eleanor');
    const nazukaChar = Object.values(characters).find((c) => c.name.EN === 'Nazuka');
    if (sWillowChar && eleanorChar && nazukaChar) {
      const ewRoster: PresetBuffRosterSlot[] = [
        { slot: 'vanguard', character: eleanorChar },
        { slot: 'versatile', character: nazukaChar },
        { slot: 'support', character: sWillowChar },
      ];
      const ewBuild = makeEmptyBuild();
      ewBuild.slots.support = {
        characterId: Number(sWillowChar.id),
        potentials: [{ id: 516523, rarity: 2, level: 6 }],
      };
      // Also test extractEffectsFromText + resolveTargets directly
      const foamEffects = extractEffectsFromText(
        "Increases own and non-Aqua Squadmates' ATK by 74.4%.",
        'own'
      );
      assert.equal(foamEffects[0]?.stat, 'atkPct');
      assert.equal(foamEffects[0]?.elementScope, undefined);
      assert.equal(foamEffects[0]?.excludeElement, 'Aqua');
      assert.equal(foamEffects[0]?.includesOwnWithExcluded, true);
      // Verify on ewRoster via extractSkillKitPresetBuffs or potential
      assert.ok(ewRoster.length === 3);
    }

    // 3. DMG Taken of all Elements -> elementTaken (not dmgTaken)
    const rainbow = extractEffectsFromText(
      'Increases the target\'s DMG Taken of all Elements by 33%.',
      'own'
    );
    assert.equal(rainbow[0]?.stat, 'elementTaken');
    assert.equal(rainbow[0]?.elementScope, undefined);
    assert.equal(rainbow[0]?.value, 33);

    // 4. Devouring Shadow compound clause target/element inheritance
    const devouring = extractEffectsFromText(
      "Increases Umbra Trekkers' Umbra DMG by 18% and DEF PEN by 100.",
      'own'
    );
    assert.equal(devouring.length, 2);
    assert.equal(devouring[1]?.stat, 'defPen');
    assert.equal(devouring[1]?.value, 100);
    assert.equal(devouring[1]?.targetHint, 'squad');
    assert.equal(devouring[1]?.elementScope, 'Umbra');

    // 5. Leyline Amp mutually exclusive squad-composition clauses
    const gerieChar = Object.values(characters).find((c) => c.name.EN === 'Gerie');
    const nazunaChar = Object.values(characters).find((c) => c.name.EN === 'Nazuna');
    const leafiaChar = Object.values(characters).find((c) => c.name.EN === 'Leafia');
    if (gerieChar && nazunaChar && leafiaChar) {
      const allTerraRoster: PresetBuffRosterSlot[] = [
        { slot: 'vanguard', character: gerieChar },
        { slot: 'versatile', character: nazunaChar },
        { slot: 'support', character: leafiaChar },
      ];
      assert.equal(
        isPotentialSquadConditionBlocked(
          'In an all-Terra squad, increases Terra Trekkers\' ATK by 60%.',
          allTerraRoster
        ),
        false
      );
      assert.equal(
        isPotentialSquadConditionBlocked(
          'If there is only 1 Terra Trekker in the squad, increases ATK by 40%.',
          allTerraRoster
        ),
        true
      );
    }

    // 6. Peak Performance: gains 6 stacks, each increasing ... by 200%, removes 1 stack per second
    const peakClause =
      'Fuyuka gains 6 stacks of Peak Performance, each increasing her Ultimate DMG by 200%, and removes 1 stack per second.';
    const peakEffects = extractEffectsFromText(peakClause, 'own');
    assert.equal(peakEffects[0]?.stacks, 6);
    assert.equal(peakEffects[0]?.value, 1200);
    const peakUptime = estimatePotentialRealisticUptime(peakClause, 6);
    assert.ok(Math.abs(peakUptime - 7 / 12) < 1e-3, `Expected ~0.5833, got ${peakUptime}`);
  });

  it('extractSkillKitPresetBuffs extracts S.Willow, Tilia, Cosette, Firstlight Noya buffs without Safety Alert 4046% bug', () => {
    const sWillow = Object.values(characters).find((c) => c.name.EN === 'Suntide Willow');
    const tilia = characters['107'];
    const cosette = characters['142'];
    const fnoya = characters['162'];
    assert.ok(sWillow && tilia && cosette && fnoya);

    const emptyEmblems = { '70': [], '80': [], '90': [] };
    const roster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: fnoya },
      { slot: 'versatile', character: cosette },
      { slot: 'support', character: sWillow },
    ];
    const fighters: FighterInput[] = [
      {
        state: { slot: 'vanguard', level: '90', skillLevel: 10, affinityLevel: 30, talentTier: 0, emblems: emptyEmblems, rotation: [] },
        character: fnoya,
        combat: combatDb[String(fnoya.id)],
      },
      {
        state: { slot: 'versatile', level: '90', skillLevel: 10, affinityLevel: 30, talentTier: 5, emblems: emptyEmblems, rotation: [] },
        character: cosette,
        combat: combatDb[String(cosette.id)],
      },
      {
        state: { slot: 'support', level: '90', skillLevel: 10, affinityLevel: 30, talentTier: 0, emblems: emptyEmblems, rotation: [] },
        character: sWillow,
        combat: combatDb[String(sWillow.id)],
      },
    ];

    const kitBuffs = extractSkillKitPresetBuffs(fighters, roster);
    assert.ok(!kitBuffs.some((b) => b.value > 1000), 'Must not emit spurious >1000% Safety Alert buff');
    assert.ok(kitBuffs.some((b) => b.sourceName === 'Suntide Willow' && b.stat === 'atkPct'));
    assert.ok(kitBuffs.some((b) => b.sourceName === 'Firstlight Noya' && b.stat === 'critRate'));

    // Also verify Tilia Support Skill Squad ATK%
    const tiliaBuffs = extractSkillKitPresetBuffs(
      [{ state: { slot: 'support', level: '90', skillLevel: 10, affinityLevel: 30, talentTier: 5, emblems: emptyEmblems, rotation: [] }, character: tilia, combat: combatDb['107'] }],
      [{ slot: 'vanguard', character: fnoya }, { slot: 'versatile', character: null }, { slot: 'support', character: tilia }]
    );
    assert.ok(tiliaBuffs.some((b) => b.sourceName === 'Tilia' && b.stat === 'atkPct' && b.target === 'team'));
  });

  it('fixes RC-3 parser bugs: Cat\'s Treasure stack bleed, Words Unchanged, Touch \'n\' Bounce uptime, Mindflare Butterfly, Forest Princess\' Blessing, Swift Wipe, Wide Blade Arc, Blinding Beam, Lethal Inferno, Hovering Gale metadata', () => {
    // 1. The Cat's Treasure (214029 C6): Melody skillDmg = 50 (unstacked), Harmony Dark Evil Eye = 3 stacks
    const fuyuka = characters['134']; // Ignis Vanguard
    const sLaru = characters['158']; // Ignis Versatile
    const flora = characters['126']; // Ignis Support
    const ignisRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: fuyuka },
      { slot: 'versatile', character: sLaru },
      { slot: 'support', character: flora },
    ];
    const catBuffs = extractDiscPresetBuffs(
      [{ discId: 214029, level: 90, crescendo: 6 }],
      {},
      discs,
      ignisRoster,
      undefined,
      { enforceTriggers: true, forceHarmonyLevel: 5 }
    );
    const catSkillDmg = catBuffs.find((b) => b.origin === 'melody' && b.stat === 'skillDmg');
    assert.ok(catSkillDmg, 'Expected Cat\'s Treasure Melody skillDmg');
    assert.equal(catSkillDmg.value, 50);
    assert.equal(catSkillDmg.stacks, undefined);
    const catHarmonyCrit = catBuffs.find((b) => b.origin === 'harmony' && b.stat === 'skillCritDmg');
    assert.ok(catHarmonyCrit, 'Expected Cat\'s Treasure Harmony skillCritDmg');
    assert.equal(catHarmonyCrit.stacks, 3);

    // 2. Words Unchanged (516025 Lv 6): elementTaken (Aqua) stacks: 12, value: 24
    const sWillow = Object.values(characters).find((c) => c.name.EN === 'Suntide Willow')!;
    const chitose = characters['144'];
    const teresa = characters['127'];
    const aquaRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: chitose },
      { slot: 'versatile', character: teresa },
      { slot: 'support', character: sWillow },
    ];
    const aquaBuild = makeEmptyBuild();
    aquaBuild.slots.vanguard = { characterId: chitose.id, potentials: [] };
    aquaBuild.slots.versatile = { characterId: teresa.id, potentials: [] };
    aquaBuild.slots.support = {
      characterId: sWillow.id,
      potentials: [
        { id: 516025, rarity: 2, level: 6 },
        { id: 516009, rarity: 2, level: 6 },
      ],
    };
    const aquaPotBuffs = extractPotentialPresetBuffs(aquaBuild, aquaRoster, { potentialLookup: potLookup });
    const wordsBuff = aquaPotBuffs.find((b) => b.potentialId === 516025 && b.stat === 'elementTaken');
    assert.ok(wordsBuff, 'Expected Words Unchanged elementTaken');
    assert.equal(wordsBuff.stacks, 12);
    assert.equal(wordsBuff.value, 24);

    // 3. Touch 'n' Bounce (516009 Lv 6): squad skillDmg = 40 & non-Aqua skillDmg = 56 with realisticUptime >= 0.85
    const eleanor = characters['137'];
    const nazuka = characters['133'];
    const willowEleanorRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: sWillow },
      { slot: 'versatile', character: eleanor },
      { slot: 'support', character: nazuka },
    ];
    const weBuild = makeEmptyBuild();
    weBuild.slots.vanguard = { characterId: sWillow.id, potentials: [{ id: 516009, rarity: 2, level: 6 }] };
    weBuild.slots.versatile = { characterId: eleanor.id, potentials: [] };
    weBuild.slots.support = { characterId: nazuka.id, potentials: [] };
    const touchBuffs = extractPotentialPresetBuffs(weBuild, willowEleanorRoster, { potentialLookup: potLookup });
    const touchTeam = touchBuffs.find((b) => b.stat === 'skillDmg' && b.target === 'team');
    const touchNonAqua = touchBuffs.filter((b) => b.stat === 'skillDmg' && b.value === 56);
    assert.ok(touchTeam && touchTeam.value === 40, `Expected Touch 'n' Bounce team skillDmg=40, got ${JSON.stringify(touchBuffs)}`);
    assert.ok(touchNonAqua.length >= 1, `Expected Touch 'n' Bounce non-Aqua skillDmg=56, got ${JSON.stringify(touchBuffs)}`);
    assert.ok((touchTeam.realisticUptime ?? 1) >= 0.85, `Expected realisticUptime >= 0.85 on Touch 'n' Bounce, got ${touchTeam.realisticUptime}`);
    assert.ok((touchNonAqua[0].realisticUptime ?? 1) >= 0.85, `Expected realisticUptime >= 0.85 on Touch 'n' Bounce non-Aqua, got ${touchNonAqua[0].realisticUptime}`);

    // 4. Reinforced Impression (512629 Lv 6): Mindflare Butterfly -> stacks: 4, value: 12.8
    const floraBuild = makeEmptyBuild();
    floraBuild.slots.vanguard = { characterId: fuyuka.id, potentials: [] };
    floraBuild.slots.versatile = { characterId: sLaru.id, potentials: [] };
    floraBuild.slots.support = {
      characterId: flora.id,
      potentials: [
        { id: 512629, rarity: 2, level: 6 },
        { id: 512641, rarity: 2, level: 6 },
      ],
    };
    const floraBuffs = extractPotentialPresetBuffs(floraBuild, ignisRoster, { potentialLookup: potLookup });
    const reinforced = floraBuffs.find((b) => b.potentialId === 512629 && b.stat === 'critRate');
    assert.ok(reinforced, 'Expected Reinforced Impression critRate');
    assert.equal(reinforced.stacks, 4);
    assert.equal(reinforced.value, 12.8);

    // 8b. Lethal Inferno (512641 Lv 6): realisticUptime in [0.58, 0.72]
    const lethal = floraBuffs.find((b) => b.potentialId === 512641 && b.stat === 'elementTaken');
    assert.ok(lethal, 'Expected Lethal Inferno elementTaken');
    assert.ok(
      (lethal.realisticUptime ?? 1) >= 0.58 && (lethal.realisticUptime ?? 1) <= 0.72,
      `Expected Lethal Inferno realisticUptime in [0.58, 0.72], got ${lethal.realisticUptime}`
    );

    // 5. Forest Princess' Blessing (512333 Lv 6) + Rocket Cart (515643 Lv 6)
    const wraith = characters['143'];
    const ann = characters['123'];
    const ventusRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: wraith },
      { slot: 'versatile', character: eleanor },
      { slot: 'support', character: ann },
    ];
    const annBuild = makeEmptyBuild();
    annBuild.slots.vanguard = { characterId: wraith.id, potentials: [] };
    annBuild.slots.versatile = { characterId: eleanor.id, potentials: [] };
    annBuild.slots.support = { characterId: ann.id, potentials: [{ id: 512333, rarity: 2, level: 6 }] };
    const annBuffs = extractPotentialPresetBuffs(annBuild, ventusRoster, { potentialLookup: potLookup });
    const fpb = annBuffs.find((b) => b.potentialId === 512333 && b.stat === 'elementDmg');
    assert.ok(fpb, 'Expected Forest Princess Blessing elementDmg');
    assert.equal(fpb.target, 'team');
    assert.equal(fpb.value, 54.25);

    const nazuna = characters['156'];
    const gerie = characters['149'];
    const leafia = characters['161'];
    const terraRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: leafia },
      { slot: 'versatile', character: gerie },
      { slot: 'support', character: nazuna },
    ];
    const rocketBuild = makeEmptyBuild();
    rocketBuild.slots.vanguard = { characterId: leafia.id, potentials: [] };
    rocketBuild.slots.versatile = { characterId: gerie.id, potentials: [] };
    rocketBuild.slots.support = { characterId: nazuna.id, potentials: [{ id: 515643, rarity: 2, level: 6 }] };
    const rocketBuffs = extractPotentialPresetBuffs(rocketBuild, terraRoster, { potentialLookup: potLookup });
    const rocket = rocketBuffs.find((b) => b.potentialId === 515643 && b.stat === 'elementTaken');
    assert.ok(rocket, 'Expected Rocket Cart elementTaken');
    assert.ok(
      (rocket.realisticUptime ?? 1) <= 0.15,
      `Expected Rocket Cart multi-stack chance uptime <= 0.15, got ${rocket.realisticUptime}`
    );

    // 6. Swift Wipe (513942 Lv 6) -> ultSkillIntensity: 200
    // 7. Wide Blade Arc (513908 Lv 6, all-Aqua) -> aaToMarkRatio77: 200, markCritRate: -100
    const allie = characters['139'];
    const allieRoster: PresetBuffRosterSlot[] = [
      { slot: 'vanguard', character: allie },
      { slot: 'versatile', character: teresa },
      { slot: 'support', character: sWillow },
    ];
    const allieBuild = makeEmptyBuild();
    allieBuild.slots.vanguard = {
      characterId: allie.id,
      potentials: [
        { id: 513942, rarity: 2, level: 6 },
        { id: 513908, rarity: 2, level: 6 },
      ],
    };
    allieBuild.slots.versatile = { characterId: teresa.id, potentials: [] };
    allieBuild.slots.support = { characterId: sWillow.id, potentials: [] };
    const allieBuffs = extractPotentialPresetBuffs(allieBuild, allieRoster, { potentialLookup: potLookup });
    assert.ok(
      allieBuffs.some((b) => b.potentialId === 513942 && b.stat === 'ultSkillIntensity' && b.value === 200),
      `Expected Swift Wipe ultSkillIntensity=200, got ${JSON.stringify(allieBuffs.filter((b) => b.potentialId === 513942))}`
    );
    assert.ok(
      !allieBuffs.some((b) => b.potentialId === 513942 && b.stat === 'skillIntensity'),
      'Swift Wipe must not emit whole-kit skillIntensity'
    );
    assert.ok(
      allieBuffs.some((b) => b.potentialId === 513908 && b.stat === 'aaToMarkRatio77' && b.value === 200),
      `Expected Wide Blade Arc aaToMarkRatio77=200, got ${JSON.stringify(allieBuffs.filter((b) => b.potentialId === 513908))}`
    );
    assert.ok(
      allieBuffs.some((b) => b.potentialId === 513908 && b.stat === 'markCritRate' && b.value === -100),
      `Expected Wide Blade Arc markCritRate=-100, got ${JSON.stringify(allieBuffs.filter((b) => b.potentialId === 513908))}`
    );

    // 8a. Blinding Beam (510726 Lv 6): realisticUptime in [0.4, 0.5]
    const tilia = characters['107'];
    const blindingBuild = makeEmptyBuild();
    blindingBuild.slots.vanguard = { characterId: chitose.id, potentials: [] };
    blindingBuild.slots.versatile = { characterId: tilia.id, potentials: [{ id: 510726, rarity: 2, level: 6 }] };
    blindingBuild.slots.support = { characterId: sWillow.id, potentials: [] };
    const blindingBuffs = extractPotentialPresetBuffs(blindingBuild, [
      { slot: 'vanguard', character: chitose },
      { slot: 'versatile', character: tilia },
      { slot: 'support', character: sWillow },
    ], { potentialLookup: potLookup });
    const blinding = blindingBuffs.find((b) => b.potentialId === 510726 && b.stat === 'markTaken');
    assert.ok(blinding, 'Expected Blinding Beam markTaken');
    assert.ok(
      (blinding.realisticUptime ?? 1) >= 0.4 && (blinding.realisticUptime ?? 1) <= 0.5,
      `Expected Blinding Beam realisticUptime in [0.4, 0.5], got ${blinding.realisticUptime}`
    );

    // 9. Hovering Gale metadata (icdSec, isMarkReaction, perStackBonusPct) & skip "received this time" buff
    const hgText =
      'When a target with Smiling Sanction has Aqua Mark triggered, this target is immediately inflicted with Aqua Mark: Torrent again and receives an additional 474% of ATK as Aqua Mark DMG. For each stack of Smiling Sanction this target has, increases the Mark DMG received this time by 8.4%. This effect can only be triggered once every 1.5s.';
    const hgSpecs = extractPotentialExtraHitSpecs(hgText);
    assert.equal(hgSpecs[0]?.icdSec, 1.5);
    assert.equal(hgSpecs[0]?.isMarkReaction, true);
    assert.equal(hgSpecs[0]?.perStackBonusPct, 8.4);
    assert.equal(extractEffectsFromText(hgText, 'own').length, 0);
  });

  it('enforces Natsu 6 hardened parser guards across corpus edge cases', () => {
    // Guard 1: "for 4s, up to 2 stacks" keeps stacks=2 while Nazuka #513305 / S.Willow #516024 isolate unstacked leading part
    const compoundDur = extractEffectsFromText('Increases ATK by 10% for 4s, up to 2 stacks.', 'own');
    assert.equal(compoundDur[0]?.stacks, 2);
    assert.equal(compoundDur[0]?.value, 20);

    const nazuka = characters['133']; // Ventus Versatile
    const eleanor = characters['137']; // Ventus Versatile
    const ann = characters['123']; // Ventus Support
    const sWillow = characters['160']; // Aqua Support
    const leafia = characters['161']; // Terra Versatile
    const nanoha = characters['119']; // Ventus Vanguard
    const canace = characters['120']; // Ventus Versatile
    const flora = characters['126']; // Ignis Support
    const laru = characters['150']; // Lux Vanguard
    const karin = characters['157']; // Umbra Support
    const cosette = characters['142']; // Umbra Support
    const mistique = characters['135']; // Ignis Versatile (for slot filler)

    // Nazuka #513305: Main Skill Ventus DMG unstacked (34), target Ventus DMG Taken stacked (2 * 10 = 20)
    const nazBuild = makeEmptyBuild();
    nazBuild.slots.vanguard = { characterId: nanoha.id, potentials: [] };
    nazBuild.slots.versatile = { characterId: nazuka.id, potentials: [{ id: 513305, rarity: 2, level: 6 }] };
    nazBuild.slots.support = { characterId: ann.id, potentials: [] };
    const nazBuffs = extractPotentialPresetBuffs(nazBuild, [
      { slot: 'vanguard', character: nanoha },
      { slot: 'versatile', character: nazuka },
      { slot: 'support', character: ann },
    ], { potentialLookup: potLookup });
    const nazEl = nazBuffs.find((b) => b.potentialId === 513305 && b.stat === 'skillDmg');
    const nazTaken = nazBuffs.find((b) => b.potentialId === 513305 && b.stat === 'elementTaken');
    assert.equal(nazEl?.stacks, undefined);
    assert.equal(nazEl?.value, 34);
    assert.equal(nazTaken?.stacks, 10);
    assert.equal(nazTaken?.value, 20);

    // Suntide Willow #516024: DMG Multiplier unstacked (50), Aqua DMG Taken stacked (16 * 1.1 = 17.6)
    const willowBuild = makeEmptyBuild();
    willowBuild.slots.vanguard = { characterId: sWillow.id, potentials: [{ id: 516024, rarity: 2, level: 6 }] };
    const willowBuffs = extractPotentialPresetBuffs(willowBuild, [
      { slot: 'vanguard', character: sWillow },
      { slot: 'versatile', character: null },
      { slot: 'support', character: null },
    ], { potentialLookup: potLookup });
    const willowInt = willowBuffs.find((b) => b.potentialId === 516024 && b.stat === 'skillIntensity');
    const willowTaken = willowBuffs.find((b) => b.potentialId === 516024 && b.stat === 'elementTaken');
    assert.equal(willowInt?.stacks, undefined);
    assert.equal(willowInt?.value, 50);
    assert.equal(willowTaken?.stacks, 16);
    assert.equal(willowTaken?.value, 17.6);

    // Guard 3 + Guard 5: Leafia #516122 ("This effect is permanent and stacks up to 4 times") -> skillIntensity=56, stacks=4
    const leafiaBuild = makeEmptyBuild();
    leafiaBuild.slots.support = { characterId: leafia.id, potentials: [{ id: 516122, rarity: 2, level: 6 }] };
    const leafiaBuffs = extractPotentialPresetBuffs(leafiaBuild, [
      { slot: 'vanguard', character: nanoha },
      { slot: 'versatile', character: eleanor },
      { slot: 'support', character: leafia },
    ], { potentialLookup: potLookup });
    const observer = leafiaBuffs.find((b) => b.potentialId === 516122);
    assert.equal(observer?.stat, 'skillIntensity');
    assert.equal(observer?.stacks, 4);
    assert.equal(observer?.value, 56);

    // Guard 4: Nanoha #511932 keeps own target (not leaked by "When an ally"), while "increases an ally's ATK" targets squad
    const nanBuild = makeEmptyBuild();
    nanBuild.slots.versatile = { characterId: nanoha.id, potentials: [{ id: 511932, rarity: 2, level: 6 }] };
    const nanBuffs = extractPotentialPresetBuffs(nanBuild, [
      { slot: 'vanguard', character: eleanor },
      { slot: 'versatile', character: nanoha },
      { slot: 'support', character: ann },
    ], { potentialLookup: potLookup });
    const tenderTrap = nanBuffs.find((b) => b.potentialId === 511932);
    assert.ok(tenderTrap);
    assert.equal(tenderTrap.target, 'versatile');
    const allyAction = extractEffectsFromText("Increases an ally's ATK by 20%.", 'own');
    assert.equal(allyAction[0]?.targetHint, 'squad');

    // Guard 4: Rapid on-hit refresh (Canace #512012 & Disc 214002) and Flora #512624 ("for each" + "chance to") skip chance/4-stack scaling
    const canBuild = makeEmptyBuild();
    canBuild.slots.versatile = { characterId: canace.id, potentials: [{ id: 512012, rarity: 2, level: 6 }] };
    const canBuffs = extractPotentialPresetBuffs(canBuild, [
      { slot: 'vanguard', character: nanoha },
      { slot: 'versatile', character: canace },
      { slot: 'support', character: ann },
    ], { potentialLookup: potLookup });
    assert.equal(canBuffs.find((b) => b.potentialId === 512012)?.value, 54);

    const disc214002Buffs = extractDiscPresetBuffs(
      [{ discId: 214002, level: 90, crescendo: 1 }],
      {},
      discs,
      [
        { slot: 'vanguard', character: nanoha },
        { slot: 'versatile', character: eleanor },
        { slot: 'support', character: ann },
      ],
      undefined,
      { enforceTriggers: true }
    );
    const laceration = disc214002Buffs.find((b) => b.origin === 'melody' && b.stat === 'elementTaken');
    assert.equal(laceration?.value, 10);

    const floraSparkBuild = makeEmptyBuild();
    floraSparkBuild.slots.support = { characterId: flora.id, potentials: [{ id: 512624, rarity: 2, level: 6 }] };
    const floraSparkBuffs = extractPotentialPresetBuffs(floraSparkBuild, [
      { slot: 'vanguard', character: mistique },
      { slot: 'versatile', character: eleanor },
      { slot: 'support', character: flora },
    ], { potentialLookup: potLookup });
    const spark = floraSparkBuffs.find((b) => b.potentialId === 512624);
    assert.equal(spark?.stacks, undefined);
    assert.equal(spark?.value, 14);

    // Guard 5: Eleanor #513723 ("Sentry DMG multiplier") -> skillIntensity (not skillSkillIntensity); Karin #515709 -> aaSkillIntensity
    const elBuild = makeEmptyBuild();
    elBuild.slots.support = { characterId: eleanor.id, potentials: [{ id: 513723, rarity: 2, level: 6 }] };
    const elBuffs = extractPotentialPresetBuffs(elBuild, [
      { slot: 'vanguard', character: nanoha },
      { slot: 'versatile', character: canace },
      { slot: 'support', character: eleanor },
    ], { potentialLookup: potLookup });
    const funcSustain = elBuffs.find((b) => b.potentialId === 513723 && b.stat === 'skillIntensity');
    assert.ok(funcSustain, `Expected skillIntensity on Eleanor #513723, got ${JSON.stringify(elBuffs)}`);
    assert.equal(funcSustain.stacks, 9);
    assert.equal(funcSustain.value, 124.2);

    const umbraF = characters['145']; // Otoha Umbra
    const karinBuild = makeEmptyBuild();
    karinBuild.slots.support = { characterId: karin.id, potentials: [{ id: 515709, rarity: 2, level: 6 }] };
    const karinBuffs = extractPotentialPresetBuffs(karinBuild, [
      { slot: 'vanguard', character: umbraF },
      { slot: 'versatile', character: cosette },
      { slot: 'support', character: karin },
    ], { potentialLookup: potLookup });
    const karinAa = karinBuffs.find((b) => b.potentialId === 515709);
    assert.equal(karinAa?.stat, 'aaSkillIntensity');
    assert.equal(karinAa?.value, 40);

    // Guard 6: Laru #515043 ("hits a different target") uses Ult duration scaling (~0.3333) instead of 0.65; >15s Ult not 0.65
    const laruBuild = makeEmptyBuild();
    laruBuild.slots.vanguard = { characterId: laru.id, potentials: [{ id: 515043, rarity: 2, level: 6 }] };
    const laruBuffs = extractPotentialPresetBuffs(laruBuild, [
      { slot: 'vanguard', character: laru },
      { slot: 'versatile', character: null },
      { slot: 'support', character: null },
    ], { potentialLookup: potLookup });
    const thunderSurge = laruBuffs.find((b) => b.potentialId === 515043);
    assert.ok(
      (thunderSurge?.realisticUptime ?? 1) < 0.4,
      `Expected Laru #515043 realisticUptime < 0.4, got ${thunderSurge?.realisticUptime}`
    );
    assert.equal(
      estimatePotentialRealisticUptime('When Heroic (Ultimate) fires, increases ATK by 20% for 18s, up to 5 stacks.', 5, 18),
      1
    );
  });
});
