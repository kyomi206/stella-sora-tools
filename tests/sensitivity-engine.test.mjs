import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePenCurve,
  computeTalentProgression,
  computeDiscContributions,
} from '../src/lib/calculator/sensitivity-engine.ts';
import { computePresetContributions } from '../src/lib/calculator/damage-engine.ts';
import { calculateTeam } from '../src/lib/calculator/fighter-calc.ts';
import discs from '../src/data/discs.json' with { type: 'json' };

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

function fighter({ character: unit = null, talentTier = 0 } = {}) {
  return {
    state: {
      slot: 'vanguard',
      level: '90',
      skillLevel: 10,
      affinityLevel: 0,
      talentTier,
      emblems: { '70': [], '80': [], '90': [] },
      rotation: [
        {
          id: 'vanguard-ability',
          source: 'custom',
          name: 'Test ability',
          motionValuePct: 100,
          hits: 1,
          casts: 1,
          damageType: 'Skill',
        },
      ],
    },
    character: unit,
    combat: {
      id: unit?.id ?? 0,
      name: unit?.name?.EN ?? 'Dummy',
      star: 5,
      element: unit?.element ?? 'Ignis',
      class: 'Vanguard',
      stats: { '90': { atk: 1000, hp: 10000, def: 100, vul: 0 } },
    },
  };
}

function teamInput(overrides = {}) {
  return {
    fighters: [fighter({ character: character(112, 'Noya', 'Ventus') })],
    contributions: computePresetContributions([], [], {}, {}),
    buffs: [],
    recordLevel: 0,
    enemy: { def: 500, res: 250, resilienceBroken: false },
    ...overrides,
  };
}

test('PEN curve spans 0-250 and matches the RES amendment', () => {
  const curve = computePenCurve(250);

  assert.equal(curve.length, 26);
  assert.equal(curve[0].pen, 0);
  assert.equal(curve[0].erAmend, 0.75);
  assert.equal(curve[0].gainPct, 0);
  assert.equal(curve[curve.length - 1].pen, 250);
  assert.equal(curve[curve.length - 1].erAmend, 1);
  assert.ok(Math.abs(curve[curve.length - 1].gainPct - 33.333333) < 1e-6);
});

test('talent progression is monotonic and does not mutate its input', () => {
  const input = teamInput();
  const snapshot = structuredClone(input);

  const points = computeTalentProgression(input, 'vanguard');

  assert.equal(points.length, 6);
  assert.deepEqual(input, snapshot);

  for (let index = 1; index < points.length; index++) {
    assert.ok(points[index].teamDmg >= points[index - 1].teamDmg);
    assert.ok(points[index].personalDmg >= points[index - 1].personalDmg);
  }

  assert.ok(points[points.length - 1].teamGainPct > 0);
});

test('disc contributions report the damage lost by removing a disc', () => {
  const withDisc = computePresetContributions(
    [{ discId: 211001, level: 90, crescendo: 1 }],
    [],
    {},
    discs
  );
  const withoutDisc = computePresetContributions([], [], {}, {});

  const input = teamInput({ contributions: withDisc });
  const baseline = calculateTeam(input).totalExpected;
  const entries = [{ slot: 'main', index: 0, discId: 211001, name: 'Crisp Morning' }];

  const points = computeDiscContributions(input, entries, () => withoutDisc);

  assert.equal(points.length, 1);
  assert.equal(points[0].teamDmg, calculateTeam({ ...input, contributions: withoutDisc }).totalExpected);
  assert.ok(points[0].teamDmg < baseline);
  assert.ok(points[0].lossPct > 0);
  assert.deepEqual(computeDiscContributions(input, [], () => withoutDisc), []);
});
