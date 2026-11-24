import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBuffStat,
  buildCharacterStats,
  calculateAbilityDamage,
  calculateResAmend,
  computePresetContributions,
  createEmptyStatBlock,
} from '../damage-engine.ts';
import type { EnemyInput } from '../damage-engine.ts';
import { computeDiscContributions, computePenCurve } from '../sensitivity-engine.ts';
import { getTalentMinorStatBonuses, mapTalentRow } from '../talent-emblem.ts';
import {
  getResolvedCommunityPresetById,
  type CommunityPresetEntry,
} from '../../community-presets.ts';
import referencePresetsData from './fixtures/reference-presets.json' with { type: 'json' };
import { extractDiscPresetBuffs, extractPotentialPresetBuffs, extractSkillKitPresetBuffs } from '../preset-buffs.ts';
import { aggregateDamageSources, calculateTeam, formatPartOptionLabel } from '../fighter-calc.ts';
import { calculateSupportStartingNotes, MUSICAL_NOTES } from '../../../data/notes.ts';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import type { NoteName, SSCharacter, SSDisc } from '../../../types/index.ts';

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

  it('RECORD_LEVEL_BASE_HP + AFFINITY_LEVEL_BASE_HP + HP-scaler Affinity HP% match Firstlight Noya (139,528) and Gerie (125,512)', () => {
    const fnoyaBonuses = createEmptyStatBlock();
    fnoyaBonuses.baseHp = 600;
    const fnoyaStats = buildCharacterStats({
      characterBaseAtk: 0,
      characterBaseHp: 94662,
      affinityLevel: 30,
      recordLevel: 31,
      squadDiscBaseAtk: 0,
      squadDiscBaseHp: 6990,
      element: 'Lux',
      primaryScalingStat: 'HP',
      bonuses: fnoyaBonuses,
    });
    assert.equal(fnoyaStats.baseHp, 139528);
    assert.equal(fnoyaStats.affinityHpPct, 12);

    const gerieStats = buildCharacterStats({
      characterBaseAtk: 0,
      characterBaseHp: 88236,
      affinityLevel: 30,
      recordLevel: 31,
      squadDiscBaseAtk: 0,
      squadDiscBaseHp: 0,
      element: 'Terra',
      primaryScalingStat: 'HP',
      bonuses: createEmptyStatBlock(),
    });
    assert.equal(gerieStats.baseHp, 125512);
  });

  it('resilienceBreakUptimePct scales breakMult continuously (0% -> 1.0x, 27.7778% -> 1.1389x, 100% -> 1.5x)', () => {
    const stats = buildCharacterStats({
      characterBaseAtk: 10000,
      affinityLevel: 0,
      recordLevel: 0,
      squadDiscBaseAtk: 0,
      element: 'Ignis',
      bonuses: createEmptyStatBlock(),
    });
    const ability = {
      name: 'Hit',
      motionValuePct: 100,
      hits: 1,
      casts: 1,
      damageType: 'Skill' as const,
      scalingStat: 'ATK' as const,
    };

    const r0 = calculateAbilityDamage(stats, ability, {
      def: 0,
      res: 0,
      resilienceBroken: false,
      resilienceBreakUptimePct: 0,
    });
    const rBlitz = calculateAbilityDamage(stats, ability, {
      def: 0,
      res: 0,
      resilienceBroken: false,
      resilienceBreakUptimePct: 27.7778,
    });
    const r100 = calculateAbilityDamage(stats, ability, {
      def: 0,
      res: 0,
      resilienceBroken: false,
      resilienceBreakUptimePct: 100,
    });

    assertClose(r0.breakMult, 1.0, 1e-6);
    assertClose(rBlitz.breakMult, 1.138889, 1e-5);
    assertClose(r100.breakMult, 1.5, 1e-6);
  });

  it('getTalentMinorStatBonuses extracts 4-star T5 minor stat nodes and returns empty at T0', () => {
    assert.deepEqual(getTalentMinorStatBonuses('142', 0), []);
    const sumByKey = (charId: string, tier: number) => {
      const totals: Record<string, number> = {};
      for (const b of getTalentMinorStatBonuses(charId, tier)) {
        totals[b.key] = (totals[b.key] || 0) + b.value;
      }
      return totals;
    };
    const tiliaT5 = sumByKey('107', 5);
    assert.equal(tiliaT5.baseAtk, 400);
    assert.equal(tiliaT5.baseHp, 4600);
    assert.equal(tiliaT5.skillDmg, 21);
    assert.equal(tiliaT5.ultDmg, 43);

    const cosetteT5 = sumByKey('142', 5);
    assert.equal(cosetteT5.baseAtk, 400);
    assert.equal(cosetteT5.baseHp, 4600);
    assert.equal(cosetteT5.skillDmg, 21);
    assert.equal(cosetteT5.ultDmg, 43);
  });

  it('computeDiscContributions with rebuildBuffs ranks Main Disc Deer\'s Song > Support Discs (>20% loss) on eleanor-skill-willow', () => {
    const preset = getResolvedCommunityPresetById(
      'eleanor-skill-willow',
      referencePresetsData as unknown as CommunityPresetEntry[]
    );
    assert.ok(preset);
    const chars = charactersData as unknown as Record<string, SSCharacter>;
    const discs = discsData as unknown as Record<string, SSDisc>;
    const combatDb = characterCombatData as unknown as Record<string, any>;

    const build = {
      id: preset.id,
      name: preset.title,
      createdAt: 0,
      slots: preset.advData.slots,
      mainDiscs: preset.advData.mainDiscs,
      supportDiscs: preset.advData.supportDiscs,
      targetNotes: preset.advData.targetNotes,
    };

    const rosterSlots = (['vanguard', 'versatile', 'support'] as const).map((slot) => ({
      slot,
      character: build.slots[slot].characterId ? chars[String(build.slots[slot].characterId)] ?? null : null,
    }));

    const supportStart = calculateSupportStartingNotes(build.supportDiscs, discs);
    const effectiveNotes = Object.fromEntries(
      MUSICAL_NOTES.map((n) => [
        n.name,
        build.targetNotes[n.name] !== undefined
          ? Math.max(0, Number(build.targetNotes[n.name]) || 0)
          : supportStart[n.name] || 0,
      ])
    ) as Record<NoteName, number>;

    const emptyEmblems = { '70': [], '80': [], '90': [] };
    const fighters = (['vanguard', 'versatile', 'support'] as const).map((slot) => {
      const charId = build.slots[slot].characterId;
      const character = charId ? chars[String(charId)] ?? null : null;
      const combat = charId ? combatDb[String(charId)] ?? null : null;
      return {
        state: {
          slot,
          level: '90' as const,
          skillLevel: 10,
          affinityLevel: 30,
          talentTier: character?.star === 4 ? 5 : 0,
          emblems: emptyEmblems,
          rotation: slot === 'vanguard' && combat?.skill
            ? [{ id: 's', source: 'skill' as const, name: 'Skill', damageType: 'Skill' as const, scalingStat: 'ATK' as const, motionValuePct: 1000, hits: 1, casts: 3 }]
            : [],
        },
        character,
        combat,
      };
    });

    const discEvalContext = { enforceTriggers: true, uptimeMode: 'realistic' as const, fightMode: 'single' as const, destinyCards: 10 };
    const nonDiscBuffs = [
      ...extractPotentialPresetBuffs(build, rosterSlots),
      ...extractSkillKitPresetBuffs(fighters, rosterSlots),
    ];

    const getReduced = (without: { slot: 'main' | 'support'; index: number } | null) => {
      const mainDiscs = without?.slot === 'main' ? build.mainDiscs.filter((_, i) => i !== without.index) : build.mainDiscs;
      const supportDiscs = without?.slot === 'support' ? build.supportDiscs.filter((_, i) => i !== without.index) : build.supportDiscs;
      let notes = effectiveNotes;
      if (without?.slot === 'support') {
        const rem = calculateSupportStartingNotes(supportDiscs, discs);
        notes = Object.fromEntries(
          MUSICAL_NOTES.map((n) => [n.name, Math.max(0, (effectiveNotes[n.name] || 0) - ((supportStart[n.name] || 0) - (rem[n.name] || 0)))])
        ) as Record<NoteName, number>;
      }
      return { mainDiscs, supportDiscs, notes };
    };

    const discBuffs = extractDiscPresetBuffs(build.mainDiscs, effectiveNotes, discs, rosterSlots, undefined, discEvalContext);
    const toTeamBuffs = (items: typeof discBuffs) =>
      items.map((b) => ({
        target: b.target,
        stat: b.stat,
        value: b.realisticUptime !== undefined ? +(b.value * b.realisticUptime).toFixed(4) : b.value,
      }));

    const teamInput = {
      fighters,
      contributions: computePresetContributions(build.mainDiscs, build.supportDiscs, effectiveNotes, discs),
      buffs: toTeamBuffs([...discBuffs, ...nonDiscBuffs]),
      recordLevel: 31,
      enemy: { def: 500, res: 250, resilienceBroken: false },
    };

    const entries = [
      ...build.mainDiscs.map((d, i) => ({ slot: 'main' as const, index: i, discId: d.discId!, name: discs[String(d.discId)]?.name ?? '' })),
      ...build.supportDiscs.map((d, i) => ({ slot: 'support' as const, index: i, discId: d.discId!, name: discs[String(d.discId)]?.name ?? '' })),
    ];

    const points = computeDiscContributions(
      teamInput,
      entries,
      (w) => {
        const r = getReduced(w);
        return computePresetContributions(r.mainDiscs, r.supportDiscs, r.notes, discs);
      },
      (w) => {
        const r = getReduced(w);
        return toTeamBuffs([
          ...extractDiscPresetBuffs(r.mainDiscs, r.notes, discs, rosterSlots, undefined, discEvalContext),
          ...nonDiscBuffs,
        ]);
      }
    );

    const deersSong = points.find((p) => p.slot === 'main' && p.name.includes('Deer'));
    const maxSupportLoss = Math.max(...points.filter((p) => p.slot === 'support').map((p) => p.lossPct));
    assert.ok(deersSong, 'Expected Deer\'s Song in disc sweep');
    assert.ok(deersSong.lossPct > 20, `Expected Deer's Song loss > 20%, got ${deersSong.lossPct.toFixed(2)}%`);
    assert.ok(deersSong.lossPct > maxSupportLoss, `Expected Deer's Song (${deersSong.lossPct.toFixed(2)}%) > max support (${maxSupportLoss.toFixed(2)}%)`);
  });

  it('aggregateDamageSources: merges multi-part skills, duplicate skill rows, and numbered custom potential hits', () => {
    const combatDb = characterCombatData as unknown as Record<string, any>;
    const gerieCombat = combatDb['149'];
    const makeDamage = (expectedDamage: number) => ({
      expectedDamage,
      nonCritDamage: expectedDamage,
      critDamage: expectedDamage,
      totalHits: 1,
      defAmend: 0.5,
      erAmend: 0.75,
    });
    const makeAbility = (
      id: string,
      source: 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate' | 'custom',
      name: string,
      damageType: 'Auto Attack' | 'Skill' | 'Ultimate' | 'Mark' | 'Minion',
      expected: number
    ) => ({
      entry: {
        id,
        source,
        name,
        motionValuePct: 100,
        hits: 1,
        casts: 1,
        damageType,
        scalingStat: 'ATK' as const,
      },
      damage: makeDamage(expected),
    });

    const merged = aggregateDamageSources(
      [
        makeAbility('1', 'supportSkill', 'Immediate Execution #1', 'Skill', 640),
        makeAbility('2', 'supportSkill', 'Immediate Execution #2', 'Skill', 480),
        makeAbility('3', 'supportSkill', 'Immediate Execution (Mark)', 'Mark', 4590),
        makeAbility('4', 'ultimate', 'Divine: Retribution of Evil', 'Ultimate', 2460),
        makeAbility('5', 'ultimate', 'Divine', 'Mark', 1530),
        makeAbility('6', 'normalAtk', 'Strike 1', 'Auto Attack', 50),
        makeAbility('7', 'normalAtk', 'Strike 2', 'Auto Attack', 40),
        makeAbility('8', 'custom', 'Curtain Call (#1)', 'Skill', 100),
        makeAbility('9', 'custom', 'Curtain Call (#2)', 'Skill', 150),
        makeAbility('10', 'custom', 'Zero Row', 'Skill', 0),
      ],
      gerieCombat
    );

    assert.deepEqual(merged, [
      { label: 'Immediate Execution', value: 5710 },
      { label: 'Divine: Retribution of Evil', value: 3990 },
      { label: 'Curtain Call', value: 250 },
      { label: 'Kiss of Death', value: 90 },
    ]);
  });

  it('formatPartOptionLabel: strips redundant parent skill names while keeping parts clear', () => {
    assert.equal(
      formatPartOptionLabel('Immediate Execution', { label: 'Immediate Execution #1', mvPct: 292, damageType: 'Skill' }),
      '#1 · 292%'
    );
    assert.equal(
      formatPartOptionLabel('Immediate Execution', { label: 'Immediate Execution (Mark)', mvPct: 125, damageType: 'Mark' }),
      'Mark · 125%'
    );
    assert.equal(
      formatPartOptionLabel('Glorious Smite', { label: 'Glorious Smite', mvPct: 771, damageType: 'Ultimate' }),
      'Main hit · 771%'
    );
    assert.equal(
      formatPartOptionLabel('Glorious Smite', { label: 'Glorious Smite (Skill)', mvPct: 41.3, damageType: 'Skill' }),
      'Skill · 41.3%'
    );
    assert.equal(
      formatPartOptionLabel('Divine: Retribution of Evil', { label: 'Divine', mvPct: 125, damageType: 'Mark' }),
      'Divine · 125%'
    );
    assert.equal(
      formatPartOptionLabel('Fireworks Jam', { label: 'Fireworks Jam', mvPct: 106, damageType: 'Skill' }),
      'Skill · 106%'
    );
  });

  it('scopes typeSkillIntensityPct by damage type, converts aaDmg->markDmg via aaToMarkRatio77, and clamps negative crit rate at 0%', () => {
    const bonuses = createEmptyStatBlock();
    applyBuffStat(bonuses, 'ultSkillIntensity', 200);
    applyBuffStat(bonuses, 'aaToMarkRatio77', 200);
    applyBuffStat(bonuses, 'aaDmg', 120);
    applyBuffStat(bonuses, 'markCritRate', -100);

    const stats = buildCharacterStats({
      characterBaseAtk: 10000,
      affinityLevel: 0,
      recordLevel: 0,
      squadDiscBaseAtk: 0,
      element: 'Aqua',
      bonuses,
    });

    // 120 / 1.3 = 92.307692... added to Mark DMG
    assertClose(stats.typeDmgPct.Mark, 120 / 1.3, 1e-4, 'aaToMarkRatio77 conversion');

    const enemy: EnemyInput = { def: 0, res: 0, resilienceBroken: false };
    const ultRes = calculateAbilityDamage(
      stats,
      { name: 'Ult', motionValuePct: 100, hits: 1, casts: 1, damageType: 'Ultimate', scalingStat: 'ATK' },
      enemy
    );
    const aaRes = calculateAbilityDamage(
      stats,
      { name: 'AA', motionValuePct: 100, hits: 1, casts: 1, damageType: 'Auto Attack', scalingStat: 'ATK' },
      enemy
    );
    const markRes = calculateAbilityDamage(
      stats,
      { name: 'Mark', motionValuePct: 100, hits: 1, casts: 1, damageType: 'Mark', scalingStat: 'ATK' },
      enemy
    );

    assertClose(ultRes.skillIntensityMult, 3.0, 1e-9, 'Ultimate intensity mult');
    assertClose(aaRes.skillIntensityMult, 1.0, 1e-9, 'AA intensity mult');
    assertClose(markRes.skillIntensityMult, 1.0, 1e-9, 'Mark intensity mult');
    assert.ok(markRes.expectedDamage === markRes.nonCritDamage && markRes.expectedDamage > 0, 'Mark crit rate <= 0% clamps at 0%');

    // Cap check: 390% AA DMG -> 300% raw -> capped at 200%
    const cappedBonuses = createEmptyStatBlock();
    applyBuffStat(cappedBonuses, 'aaToMarkRatio77', 200);
    applyBuffStat(cappedBonuses, 'aaDmg', 390);
    const cappedStats = buildCharacterStats({
      characterBaseAtk: 10000,
      affinityLevel: 0,
      recordLevel: 0,
      squadDiscBaseAtk: 0,
      element: 'Aqua',
      bonuses: cappedBonuses,
    });
    assertClose(cappedStats.typeDmgPct.Mark, 200, 1e-6, 'aaToMarkRatio77 cap at 200%');

    // mapTalentRow typed DMG Multiplier
    const typedRow = mapTalentRow({
      stat: 'DMG Multiplier',
      value: 0.36,
      target: 'F.Noya',
      damageTypes: ['Skill', 'Auto Attack'],
    });
    assert.deepEqual(typedRow?.keys, ['skillSkillIntensity', 'aaSkillIntensity']);
  });
});
