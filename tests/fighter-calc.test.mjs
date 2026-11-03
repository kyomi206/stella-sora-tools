import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCharacterStats,
  calculateAbilityDamage,
  computePresetContributions,
  createEmptyStatBlock,
} from '../src/lib/calculator/damage-engine.ts';
import { calculateTeam } from '../src/lib/calculator/fighter-calc.ts';
import { getEmblemStatMeta, mapTalentRow } from '../src/lib/calculator/talent-emblem.ts';

function emptyEmblems() {
  return { '70': [], '80': [], '90': [] };
}

function character(id, name, element) {
  return {
    id,
    name: { EN: name },
    star: 5,
    element,
    class: 'Vanguard',
    attackType: 'Melee',
  };
}

function fighter({
  slot = 'vanguard',
  character: unit = null,
  atk = 1000,
  element = unit?.element ?? 'Ignis',
  talentTier = 0,
  rotation = [
    {
      id: `${slot}-ability`,
      source: 'custom',
      name: 'Test ability',
      motionValuePct: 100,
      hits: 1,
      casts: 1,
      damageType: 'Skill',
    },
  ],
} = {}) {
  return {
    state: {
      slot,
      level: '90',
      skillLevel: 10,
      affinityLevel: 0,
      talentTier,
      emblems: emptyEmblems(),
      rotation,
    },
    character: unit,
    combat: {
      id: unit?.id ?? 0,
      name: unit?.name?.EN ?? 'Dummy',
      star: 5,
      element,
      class: 'Vanguard',
      stats: { '90': { atk, hp: 1000, def: 100, vul: 0 } },
    },
  };
}

function contributions() {
  return computePresetContributions([], [], {}, {});
}

function team(fighters, overrides = {}) {
  return calculateTeam({
    fighters,
    contributions: contributions(),
    buffs: [],
    recordLevel: 0,
    enemy: { def: 0, res: 0, resilienceBroken: false },
    ...overrides,
  });
}

test('calculateTeam matches the direct engine calls', () => {
  const unit = character(999, 'Synthetic Ventus', 'Ventus');
  const rotation = [
    {
      id: 'vanguard-ability',
      source: 'custom',
      name: 'Test ability',
      motionValuePct: 200,
      hits: 2,
      casts: 1,
      damageType: 'Ultimate',
    },
  ];

  const result = team([fighter({ character: unit, rotation })]);
  const bonuses = createEmptyStatBlock();

  const stats = buildCharacterStats({
    characterBaseAtk: 1000,
    affinityLevel: 0,
    recordLevel: 0,
    squadDiscBaseAtk: 0,
    element: 'Ventus',
    bonuses,
  });

  const expected = calculateAbilityDamage(
    stats,
    {
      name: 'Test ability',
      motionValuePct: 200,
      hits: 2,
      casts: 1,
      damageType: 'Ultimate',
    },
    { def: 0, res: 0, resilienceBroken: false }
  );

  assert.equal(result.fighters.length, 1);
  assert.equal(result.fighters[0].stats.finalAtk, stats.finalAtk);
  assert.equal(result.fighters[0].totals.nonCrit, expected.nonCritDamage);
  assert.equal(result.fighters[0].totals.crit, expected.critDamage);
  assert.equal(result.fighters[0].totals.expected, expected.expectedDamage);
  assert.equal(result.totalExpected, expected.expectedDamage);
});

test('squad talents from one fighter reach the other slots', () => {
  const noya = character(112, 'Noya', 'Ventus');
  const tilia = character(107, 'Tilia', 'Lux');

  const withoutTalent = team([
    fighter({ slot: 'vanguard', character: noya }),
    fighter({ slot: 'support', character: tilia, talentTier: 0 }),
  ]);
  const withTalent = team([
    fighter({ slot: 'vanguard', character: noya }),
    fighter({ slot: 'support', character: tilia, talentTier: 1 }),
  ]);

  const vanguardBefore = withoutTalent.fighters.find((item) => item.state.slot === 'vanguard');
  const vanguardAfter = withTalent.fighters.find((item) => item.state.slot === 'vanguard');

  // Tilia T1: ATK% 8.4% for the squad.
  assert.ok(
    vanguardAfter.stats.finalAtk > vanguardBefore.stats.finalAtk,
    'support squad talent must buff the vanguard'
  );
  assert.ok(
    Math.abs(vanguardAfter.stats.totalAtkPct - (vanguardBefore.stats.totalAtkPct + 8.4)) < 1e-9
  );
});

test('self talents do not leak through the roster', () => {
  const noya = character(112, 'Noya', 'Ventus');
  const tilia = character(107, 'Tilia', 'Lux');

  const withoutNoyaTalent = team([
    fighter({ slot: 'vanguard', character: noya, talentTier: 0 }),
    fighter({ slot: 'support', character: tilia }),
  ]);
  const withNoyaTalent = team([
    fighter({ slot: 'vanguard', character: noya, talentTier: 5 }),
    fighter({ slot: 'support', character: tilia }),
  ]);

  const supportBefore = withoutNoyaTalent.fighters.find((item) => item.state.slot === 'support');
  const supportAfter = withNoyaTalent.fighters.find((item) => item.state.slot === 'support');

  assert.equal(supportAfter.stats.finalAtk, supportBefore.stats.finalAtk);
});

test('ATK% (Perma) talents route into the permanent ATK bucket', () => {
  const eleanor = character(137, 'Eleanor', 'Ventus');
  const result = team([fighter({ slot: 'vanguard', character: eleanor, talentTier: 2 })]);
  const vanguard = result.fighters[0];

  // Eleanor T2: ATK% (Perma) 33%, target self.
  assert.equal(vanguard.stats.atkPctPerma, 33);
  assert.equal(
    mapTalentRow({ stat: 'ATK% (Perma)', value: 0.33, target: 'Eleanor' })?.key,
    'atkPctPerma'
  );
});

test('ATK% (Perma) emblems route into the permanent ATK bucket', () => {
  assert.equal(getEmblemStatMeta('ATK% (Perma)')?.key, 'atkPctPerma');
});

test('element-scoped talents only land on matching damage dealers', () => {
  const ventus = character(998, 'Synthetic Ventus', 'Ventus');
  const terra = character(997, 'Synthetic Terra', 'Terra');
  const nazuna = character(156, 'Nazuna', 'Terra');

  const ventusTeam = team([
    fighter({ slot: 'vanguard', character: ventus }),
    fighter({ slot: 'support', character: nazuna, talentTier: 3 }),
  ]);
  const terraTeam = team([
    fighter({ slot: 'vanguard', character: terra }),
    fighter({ slot: 'support', character: nazuna, talentTier: 3 }),
  ]);

  const ventusVanguard = ventusTeam.fighters.find((item) => item.state.slot === 'vanguard');
  const terraVanguard = terraTeam.fighters.find((item) => item.state.slot === 'vanguard');

  // Nazuna T3: Terra taken 14% for the squad.
  assert.equal(ventusVanguard.stats.elementTakenPct, 0);
  assert.ok(Math.abs(terraVanguard.stats.elementTakenPct - 14) < 1e-9);
});
