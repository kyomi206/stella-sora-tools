import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCharacterStats,
  calculateAbilityDamage,
  calculateResAmend,
  computePresetContributions,
  createEmptyStatBlock,
} from '../damage-engine.ts';
import type { EnemyInput } from '../damage-engine.ts';
import { computePenCurve } from '../sensitivity-engine.ts';
import { mapTalentRow } from '../talent-emblem.ts';
import type { NoteName, SSDisc } from '../../../types/index.ts';

function assertClose(actual: number, expected: number, tol = 1e-6, msg?: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ? `${msg}: ` : ''}expected ${expected} but got ${actual} (diff: ${Math.abs(actual - expected)})`
  );
}

describe('spreadsheet parity tests (Maygi V1.1.0 / ZiLenTz / AutumnVN)', () => {
  it('calculateResAmend: removes artificial 250 RES PEN cap against Raid (570) and Neutral (750) RES', () => {
    const raid0 = calculateResAmend(570, 0);
    assertClose(raid0.effectiveRes, 570);
    assertClose(raid0.erAmend, 0.54783073161, 1e-9);

    const raid110 = calculateResAmend(570, 110);
    assertClose(raid110.effectiveRes, 460);
    assertClose(raid110.erAmend, 0.60614375043, 1e-9);

    const raid220 = calculateResAmend(570, 220);
    assertClose(raid220.effectiveRes, 350);
    assertClose(raid220.erAmend, 0.64015967808, 1e-9);

    // 3x Rainbow PEN = 330 PEN (previously silently capped at 250)
    const raid330 = calculateResAmend(570, 330);
    assertClose(raid330.effectiveRes, 240);
    assertClose(raid330.erAmend, 1 - 0.25 * (240 / 250) ** 2, 1e-9);

    // Weak boss (250 RES) pushed negative by 330 flat PEN + 5% VUL
    const weakOverpen = calculateResAmend(250, 330, 5, 0);
    assertClose(weakOverpen.effectiveRes, -80);
    assertClose(weakOverpen.erAmend, 1 + 0.05 * 0.1 + 0.05 * -80 * -0.01 * 0.9, 1e-9);
  });

  it('calculateResAmend: handles fractional effectiveRes in (250, 251) and (750, 751) without dipping below bracket floor', () => {
    const mid1 = calculateResAmend(300, 0, 0, 16.5); // 250.5
    assertClose(mid1.effectiveRes, 250.5);
    assertClose(mid1.erAmend, 0.65, 1e-9, '250.5 should clamp at 0.65 (1 - 0.35)');

    const mid2 = calculateResAmend(1000, 0, 0, 24.95); // 750.5
    assertClose(mid2.effectiveRes, 750.5);
    assertClose(mid2.erAmend, 0.1, 1e-9, '750.5 should clamp at 0.10 (1 - 0.90)');
  });

  it('ZiLenTz FirenzeOtoha (B1) parity: Main Skill vs Clone (Minion) additive ATK%', () => {
    const bonuses = createEmptyStatBlock();
    bonuses.atkPctPerma = 105.5; // base permanent/squad ATK% -> 2.055x
    bonuses.minionAtkPct = 51; // minion-eligible dynamic ATK% -> +0.51 = 2.565x
    bonuses.atkPct = 198; // local/Skill/Main-only dynamic ATK% -> +1.98 = 4.035x
    bonuses.critRatePct = 2; // 5 + 2 = 7%
    bonuses.critDmgPct = 6.9; // 150 + 6.9 = 156.9%
    bonuses.elementDmgPct = 218.5; // 3.185x
    bonuses.elementTakenPct = 132.7; // 2.327x
    bonuses.typeDmgPct.Skill = 88.9; // 1.889x
    bonuses.defPen = 100; // 500 - 100 = 400 effective DEF -> 13/23 = 0.5652173913

    const stats = buildCharacterStats({
      characterBaseAtk: 20494,
      affinityLevel: 0,
      recordLevel: 0,
      squadDiscBaseAtk: 0,
      element: 'Umbra',
      bonuses,
    });

    const enemy: EnemyInput = { def: 500, res: 250, resilienceBroken: false };

    const mainSkill = calculateAbilityDamage(
      stats,
      {
        name: 'Main Skill',
        motionValuePct: 304,
        hits: 1,
        casts: 1,
        damageType: 'Skill',
        scalingStat: 'ATK',
      },
      enemy
    );
    assertClose(mainSkill.effectiveStat, 82693.29, 1e-2);
    assertClose(mainSkill.nonCritDamage, 1491964, 1);
    assertClose(mainSkill.critDamage, 2340892, 1);
    assertClose(mainSkill.expectedDamage, 1551389, 1);

    const cloneMinion = calculateAbilityDamage(
      stats,
      {
        name: 'Clone',
        motionValuePct: 113.1,
        hits: 1,
        casts: 1,
        damageType: 'Minion',
        scalingStat: 'ATK',
      },
      enemy
    );
    assertClose(cloneMinion.effectiveStat, 52567.11, 1e-2);
    assertClose(cloneMinion.nonCritDamage, 186792, 1);
    assertClose(cloneMinion.critDamage, 293077, 1);
    assertClose(cloneMinion.expectedDamage, 194232, 1);
  });

  it('Maygi generic dmgTaken (All) stacks multiplicatively with typeTaken and elementTaken', () => {
    const bonuses = createEmptyStatBlock();
    bonuses.dmgTakenPct = 45;
    bonuses.typeTakenPct.Skill = 20;
    bonuses.elementTakenPct = 10;

    const stats = buildCharacterStats({
      characterBaseAtk: 10000,
      affinityLevel: 0,
      recordLevel: 0,
      squadDiscBaseAtk: 0,
      element: 'Aqua',
      bonuses,
    });

    const res = calculateAbilityDamage(
      stats,
      {
        name: 'Hydro Hit',
        motionValuePct: 100,
        hits: 1,
        casts: 1,
        damageType: 'Skill',
        scalingStat: 'ATK',
      },
      { def: 0, res: 0, resilienceBroken: false }
    );

    assertClose(res.dmgTakenMult, 1.45, 1e-9);
    // 10000 * 1.0 * 1.45 * 1.2 * 1.1 * (1 + 0.05 * 0.5) = 19140 * 1.025 = 19618.5
    assertClose(res.nonCritDamage, 19140, 1);
    assertClose(res.expectedDamage, 19619, 1);
  });

  it('Musical Notes clamp at 99 per type and Firstlight Noya DMG Multiplier routes to skillIntensity', () => {
    const discsMap: Record<string, SSDisc> = {};
    const notes: Partial<Record<NoteName, number>> = {
      'Melody of Pummel': 150,
    };
    const contrib = computePresetContributions([], [], notes, discsMap);
    assertClose(contrib.noteAtkPct, +(99 * 0.3).toFixed(2), 1e-6);

    const mapped = mapTalentRow({ stat: 'DMG Multiplier', value: 0.36, target: 'F.Noya' });
    assert.deepEqual(mapped, {
      key: 'skillIntensity',
      value: 36,
      target: 'F.Noya',
    });
  });

  it('computePenCurve spans above 250 PEN for Raid bosses', () => {
    const curve = computePenCurve(570);
    const last = curve[curve.length - 1];
    assert.ok(last.pen >= 600, `expected curve maxPen >= 600, got ${last.pen}`);
  });
});
