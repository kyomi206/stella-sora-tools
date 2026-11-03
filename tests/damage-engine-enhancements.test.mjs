import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBuffStat,
  buildCharacterStats,
  calculateAbilityDamage,
  calculateDefAmend,
  computePresetContributions,
  createEmptyStatBlock,
} from '../src/lib/calculator/damage-engine.ts';
import { getEmblemStatMeta, mapTalentRow } from '../src/lib/calculator/talent-emblem.ts';

import discs from '../src/data/discs.json' with { type: 'json' };

function makeStats({
  atk = 1000,
  hp = 0,
  def = 0,
  squadHp = 0,
  perma = 0,
  dynamic = 0,
  hpPct = 0,
  defPct = 0,
  baseHp = 0,
  baseDef = 0,
  configure,
} = {}) {
  const bonuses = createEmptyStatBlock();
  bonuses.atkPctPerma = perma;
  bonuses.atkPct = dynamic;
  bonuses.hpPct = hpPct;
  bonuses.defPct = defPct;
  bonuses.baseHp = baseHp;
  bonuses.baseDef = baseDef;
  configure?.(bonuses);

  return buildCharacterStats({
    characterBaseAtk: atk,
    characterBaseHp: hp,
    characterBaseDef: def,
    affinityLevel: 0,
    recordLevel: 0,
    squadDiscBaseAtk: 0,
    squadDiscBaseHp: squadHp,
    element: 'Ignis',
    bonuses,
  });
}

function hit(stats, overrides = {}) {
  return calculateAbilityDamage(
    stats,
    {
      name: 'Test',
      motionValuePct: 100,
      hits: 1,
      casts: 1,
      damageType: 'Skill',
      ...overrides,
    },
    { def: 0, res: 0, resilienceBroken: false }
  );
}

test('DEF PEN% scales the flat pen before mitigation', () => {
  const scaled = calculateDefAmend(500, 0, 100, 0, 50);
  const flat = calculateDefAmend(500, 0, 150, 0);

  assert.equal(scaled.effectiveDef, 350);
  assert.equal(scaled.effectiveDef, flat.effectiveDef);
  assert.equal(scaled.defAmend, flat.defAmend);
});

test('minion ATK uses multiplicative permanent and dynamic buckets', () => {
  const stats = makeStats({ atk: 1000, perma: 20, dynamic: 30 });

  assert.equal(stats.finalAtk, 1500);

  const minion = hit(stats, { damageType: 'Minion' });
  const skill = hit(stats, { damageType: 'Skill' });

  assert.equal(minion.effectiveStat, 1560);
  assert.equal(minion.nonCritDamage, 1560);
  assert.equal(skill.effectiveStat, 1500);
  assert.equal(skill.nonCritDamage, 1500);
});

test('HP scaling uses the final HP stat', () => {
  const stats = makeStats({ hp: 1000, squadHp: 200, hpPct: 20 });
  assert.equal(stats.baseHp, 1200);
  assert.equal(stats.finalHp, 1440);

  const result = calculateAbilityDamage(
    stats,
    {
      name: 'HP skill',
      motionValuePct: 100,
      hits: 1,
      casts: 1,
      damageType: 'Skill',
      scalingStat: 'HP',
    },
    { def: 500, res: 0, resilienceBroken: false }
  );

  assert.equal(result.scalingStat, 'HP');
  assert.equal(result.effectiveStat, 1440);
  assert.equal(result.nonCritDamage, 720);
});

test('DEF scaling uses the final DEF stat', () => {
  const stats = makeStats({ def: 500, defPct: 20 });
  assert.equal(stats.finalDef, 600);

  const result = hit(stats, { scalingStat: 'DEF' });
  assert.equal(result.effectiveStat, 600);
  assert.equal(result.nonCritDamage, 600);
});

test('missing scaling stat defaults to ATK', () => {
  const stats = makeStats({ atk: 1000, perma: 20, dynamic: 30 });
  const result = hit(stats);

  assert.equal(result.scalingStat, 'ATK');
  assert.equal(result.effectiveStat, 1500);
  assert.equal(result.nonCritDamage, 1500);
});

test('slot crit DMG only affects its damage type', () => {
  const stats = makeStats({
    configure: (bonuses) => applyBuffStat(bonuses, 'skillCritDmg', 20),
  });

  const skill = hit(stats, { damageType: 'Skill' });
  const auto = hit(stats, { damageType: 'Auto Attack' });

  // Base crit DMG is 150%; Skill gains 20.
  assert.equal(stats.critDmgPct, 150);
  assert.equal(skill.critDamage, 1700);
  assert.equal(auto.critDamage, 1500);
});

test('slot crit rate only affects its damage type', () => {
  const stats = makeStats({
    configure: (bonuses) => applyBuffStat(bonuses, 'aaCritRate', 15),
  });

  const auto = hit(stats, { damageType: 'Auto Attack' });
  const skill = hit(stats, { damageType: 'Skill' });

  // Base crit rate is 5%, base crit DMG 150%.
  assert.equal(auto.expectedDamage, 1100);
  assert.equal(skill.expectedDamage, 1025);
});

test('crit rate clamps to 100% after slot bonuses', () => {
  const stats = makeStats({
    configure: (bonuses) => {
      bonuses.critRatePct = 120;
      applyBuffStat(bonuses, 'aaCritRate', 15);
    },
  });

  const auto = hit(stats, { damageType: 'Auto Attack' });
  assert.equal(auto.expectedDamage, auto.critDamage);
  assert.equal(auto.expectedDamage, 1500);
});

test('crit emblems and talents keep their damage type', () => {
  assert.equal(getEmblemStatMeta('Skill Crit rate%')?.key, 'skillCritRate');
  assert.equal(
    mapTalentRow({ stat: 'Skill Crit rate%', value: 0.1, target: 'Ignis' })?.key,
    'skillCritRate'
  );
  assert.equal(
    mapTalentRow({ stat: 'Skill Crit rate%', value: 0.1, target: 'Ignis' })?.element,
    'Ignis'
  );
});

test('disc HP joins the squad HP pool', () => {
  const contributions = computePresetContributions(
    [{ discId: 211001, level: 90, crescendo: 1 }],
    [],
    {},
    discs
  );

  assert.equal(contributions.discBaseHp, 3120);
  assert.equal(contributions.discBaseAtk, 327);
});
