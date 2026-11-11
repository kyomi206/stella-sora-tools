// Characterization tests: pin today's outputs so a change is noticed. They are not checked against the game or the spreadsheets.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBreakthroughTiers,
  getSkillTiers,
  calculateTrekkerCosts,
} from '../resource-engine.ts';
import {
  getAffinityBonuses,
  calculateDefAmend,
  calculateResAmend,
  buildCharacterStats,
  calculateAbilityDamage,
  createEmptyStatBlock,
  computePresetContributions,
} from '../damage-engine.ts';
import type { AbilityInput, EnemyInput } from '../damage-engine.ts';
import { calculateTeam } from '../fighter-calc.ts';
import type { TeamCalcInput, RotationAbility, CharacterCombatEntry } from '../fighter-calc.ts';
import type { SSCharacter } from '../../../types/index.ts';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };

function assertClose(actual: number, expected: number, msg?: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${msg ? `${msg}: ` : ''}expected ${expected} but got ${actual} (diff: ${Math.abs(actual - expected)})`
  );
}

describe('calculator characterization tests', () => {
  it('resource-engine: getBreakthroughTiers(1, 90) and getSkillTiers(1, 10)', () => {
    const btTiers = getBreakthroughTiers(1, 90);
    assert.deepEqual(btTiers, [1, 2, 3, 4, 5, 6, 7, 8]);

    const skillTiers = getSkillTiers(1, 10);
    assert.deepEqual(skillTiers, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('resource-engine: calculateTrekkerCosts for character id 144 (levels 1->90, skills 1->10)', () => {
    const costs = calculateTrekkerCosts({
      characterId: '144',
      startLevel: 1,
      targetLevel: 90,
      skills: {
        combat: { current: 1, target: 10 },
        support: { current: 1, target: 10 },
        ultimate: { current: 1, target: 10 },
        normal: { current: 1, target: 10 },
      },
    });

    assertClose(costs.dorra, 37380700, 'total dorra');
    assertClose(costs.breakthroughDorra, 2257900, 'breakthrough dorra');
    assertClose(costs.skillDorra, 35122800, 'skill dorra');

    assert.deepEqual(costs.breakthroughItems, [
      { name: 'Spotlight Bowler', count: 315 },
      { name: 'Exeunt Bowler', count: 100 },
      { name: 'Backstage Ragged Hat', count: 85 },
    ]);
  });

  it('damage-engine: getAffinityBonuses(0) and getAffinityBonuses(10)', () => {
    const aff0 = getAffinityBonuses(0);
    assertClose(aff0.baseAtk, 0, 'affinity 0 baseAtk');
    assertClose(aff0.atkPct, 0, 'affinity 0 atkPct');

    const aff10 = getAffinityBonuses(10);
    assertClose(aff10.baseAtk, 288, 'affinity 10 baseAtk');
    assertClose(aff10.atkPct, 8, 'affinity 10 atkPct');
  });

  it('damage-engine: calculateDefAmend and calculateResAmend for fixed inputs', () => {
    const defResult = calculateDefAmend(500, 50, 20, 10, 5);
    assertClose(defResult.effectiveDef, 379, 'effectiveDef');
    assertClose(defResult.defAmend, 0.5803808680248007, 'defAmend');

    const resResult = calculateResAmend(250, 20, 10, 5);
    assertClose(resResult.effectiveRes, 217.5, 'effectiveRes');
    assertClose(resResult.erAmend, 0.810775, 'erAmend');
  });

  it('damage-engine: buildCharacterStats chained into calculateAbilityDamage', () => {
    const stats = buildCharacterStats({
      characterBaseAtk: 1000,
      characterBaseHp: 10000,
      characterBaseDef: 500,
      affinityLevel: 10,
      recordLevel: 31,
      squadDiscBaseAtk: 400,
      squadDiscBaseHp: 2000,
      element: 'Ignis',
      bonuses: createEmptyStatBlock(),
    });

    const ability: AbilityInput = {
      name: 'Test Ability',
      motionValuePct: 250,
      hits: 2,
      casts: 1,
      damageType: 'Skill',
      scalingStat: 'ATK',
    };

    const enemy: EnemyInput = {
      def: 500,
      res: 250,
      resilienceBroken: false,
    };

    const damageResult = calculateAbilityDamage(stats, ability, enemy);
    assertClose(damageResult.expectedDamage, 10013, 'expectedDamage');
    assertClose(damageResult.critDamage, 14653, 'critDamage');
    assertClose(damageResult.nonCritDamage, 9769, 'nonCritDamage');
  });

  it('fighter-calc: calculateTeam mimicking theoretical-damage-calculator', () => {
    const characters = charactersData as unknown as Record<string, SSCharacter>;
    const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
    const discs = discsData as unknown as Record<string, unknown>;

    const charId = '103';
    const char = characters[charId] ?? null;
    const combat = combatDb[charId] ?? null;

    const contributions = computePresetContributions([], [], {}, discs as any);

    const createEmptyEmblemRows = () =>
      Array.from({ length: 4 }, () => ({ stat: '', rarity: 'Rainbow' as const }));

    const emblems = {
      '70': createEmptyEmblemRows(),
      '80': createEmptyEmblemRows(),
      '90': createEmptyEmblemRows(),
    };

    const rotation: RotationAbility[] = combat?.ultimate
      ? [
          {
            id: 'vanguard-initial',
            source: 'ultimate',
            name: combat.ultimate.name,
            icon: combat.ultimate.icon,
            motionValuePct: 1101,
            hits: 1,
            casts: 1,
            damageType: 'Ultimate',
            scalingStat: 'ATK',
          },
        ]
      : [];

    const teamInput: TeamCalcInput = {
      fighters: [
        {
          state: {
            slot: 'vanguard',
            level: '90',
            skillLevel: 10,
            affinityLevel: 30,
            talentTier: 5,
            emblems,
            rotation,
          },
          character: char,
          combat,
        },
        {
          state: {
            slot: 'versatile',
            level: '90',
            skillLevel: 10,
            affinityLevel: 30,
            talentTier: 5,
            emblems,
            rotation: [],
          },
          character: null,
          combat: null,
        },
        {
          state: {
            slot: 'support',
            level: '90',
            skillLevel: 10,
            affinityLevel: 30,
            talentTier: 5,
            emblems,
            rotation: [],
          },
          character: null,
          combat: null,
        },
      ],
      contributions,
      buffs: [],
      recordLevel: 31,
      enemy: { def: 500, res: 250, resilienceBroken: false },
    };

    const teamResult = calculateTeam(teamInput);
    assertClose(teamResult.totalExpected, 127013, 'team totalExpected');
  });
});
