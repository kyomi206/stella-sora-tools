import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import {
  getEmblemRarities,
  getEmblemSkillLevelBonuses,
  getEmblemStatOptions,
  getEmblemValue,
  getTalentKey,
  getTalentTiers,
} from '../talent-emblem.ts';
import {
  parsePrimarySkillPart,
  parseSkillParts,
  type AbilitySource,
  type CombatSkillParams,
} from '../motion-value-parser.ts';
import type { SSCharacter } from '../../../types/index.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<
  string,
  Partial<Record<AbilitySource, CombatSkillParams>> & { name: string }
>;

describe('Phase 1 talent, alias, emblem, and MV parser parity', () => {
  it('resolves non-empty 5-tier talents for all 42 Trekkers including Leafia and aliases', () => {
    const roster = Object.values(characters);
    assert.equal(roster.length, 42);

    for (const char of roster) {
      const tiers = getTalentTiers(String(char.id), char.name.EN);
      assert.equal(tiers.length, 5, `Expected 5 talent tiers for ${char.id} (${char.name.EN})`);
    }

    assert.equal(getTalentKey('', 'Snowish Laru'), 'S.Laru');
    assert.equal(getTalentKey('', 'Springseek Coronis'), 'S.Coronis');
    assert.equal(getTalentKey('', 'Suntide Willow'), 'S.Willow');
    assert.equal(getTalentKey('', 'Firstlight Noya'), 'F.Noya');
  });

  it('provides Lv.80 Skill Level-Up rolls (+1/+3) and Lv.90 Type Crit Rate% pools accurately', () => {
    const lv80Stats = new Set(getEmblemStatOptions('80').map((opt) => opt.stat));
    for (const key of ['AA Lv+', 'Skill Lv+', 'Support Lv+', 'Ult Lv+']) {
      assert.ok(lv80Stats.has(key), `Missing ${key} in Lv.80 emblem pool`);
      assert.deepEqual(getEmblemRarities('80', key), ['Yellow', 'Rainbow']);
      assert.equal(getEmblemValue('80', key, 'Yellow'), 1);
      assert.equal(getEmblemValue('80', key, 'Rainbow'), 3);
    }

    const bonuses = getEmblemSkillLevelBonuses({
      '70': [],
      '80': [
        { stat: 'Skill Lv+', rarity: 'Rainbow' },
        { stat: 'Ult Lv+', rarity: 'Yellow' },
      ],
      '90': [],
    });
    assert.deepEqual(bonuses, { normalAtk: 0, skill: 3, supportSkill: 0, ultimate: 1 });

    const lv90Stats = new Set(getEmblemStatOptions('90').map((opt) => opt.stat));
    for (const key of [
      'AA Crit rate%',
      'Skill Crit rate%',
      'Ult Crit rate%',
      'Mark Crit rate%',
      'Minion Crit rate%',
    ]) {
      assert.ok(lv90Stats.has(key), `Missing ${key} in Lv.90 emblem pool`);
    }
    assert.ok(!lv90Stats.has('RES PEN'), 'Lv.90 emblems cannot roll RES PEN');
    assert.ok(!lv90Stats.has('Crit rate%'), 'Lv.90 emblems cannot roll Omni Crit Rate%');
  });

  it('parses all 168 skills across all 42 Trekkers without returning empty results', () => {
    const sources: AbilitySource[] = ['normalAtk', 'skill', 'supportSkill', 'ultimate'];
    let skillCount = 0;

    for (const [id, entry] of Object.entries(combatDb)) {
      for (const source of sources) {
        const skill = entry[source];
        if (!skill) continue;
        skillCount++;
        const parts = parseSkillParts(skill, source, 10);
        assert.ok(parts.length > 0, `Empty parts for ${id} ${entry.name} [${source}]`);
        for (const part of parts) {
          assert.ok(part.mvPct > 0, `Zero MV for ${id} ${entry.name} [${source}]`);
        }
      }
    }

    assert.equal(skillCount, 168);
  });

  it('extracts multi-part MVs, hits, scaling stats, and ignores buff/duration percentages', () => {
    // 126 Flora Support Skill: skips 3% Crit Rate buff, extracts 209% Skill DMG
    const floraSup = parseSkillParts(combatDb['126'].supportSkill, 'supportSkill', 10);
    assert.equal(floraSup.length, 1);
    assert.equal(floraSup[0].mvPct, 209);
    assert.equal(floraSup[0].damageType, 'Skill');

    // 114 Chaton Ultimate: skips 15s duration & 20% Ult buff
    const chatonUlt = parseSkillParts(combatDb['114'].ultimate, 'ultimate', 10);
    assert.equal(chatonUlt.length, 3);
    assert.deepEqual(
      chatonUlt.map((p) => [p.mvPct, p.hits, p.damageType]),
      [
        [428, 8, 'Ultimate'],
        [503, 1, 'Ultimate'],
        [97.2, 1, 'Mark'],
      ]
    );

    // 110 Firenze Main Skill: Skill (304% x3), Minion Clone (113.1% x3), Mark (125%)
    const firenzeSkill = parseSkillParts(combatDb['110'].skill, 'skill', 10);
    assert.deepEqual(
      firenzeSkill.map((p) => [p.mvPct, p.hits, p.damageType]),
      [
        [304, 3, 'Skill'],
        [113.1, 3, 'Minion'],
        [125, 1, 'Mark'],
      ]
    );

    // 162 Firstlight Noya Ultimate: Max HP scaling, Greatsword (AA) & Longsword (Skill) + Mark
    const fNoyaUlt = parseSkillParts(combatDb['162'].ultimate, 'ultimate', 10);
    assert.equal(fNoyaUlt.length, 5);
    assert.ok(fNoyaUlt.every((p) => p.scalingStat === 'HP'));
    assert.deepEqual(
      fNoyaUlt.map((p) => [p.mvPct, p.hits, p.damageType]),
      [
        [605, 5, 'Auto Attack'],
        [756, 1, 'Auto Attack'],
        [153, 7, 'Skill'],
        [305, 7, 'Skill'],
        [70, 1, 'Mark'],
      ]
    );

    // Tier 13 (Lv.10 + Rainbow +3 emblem) increases MV properly
    const firenzeLv13 = parsePrimarySkillPart(combatDb['110'].skill, 'skill', 13);
    assert.equal(firenzeLv13?.mvPct, 370);

    // 137 Eleanor Ultimate: backward "DMG equal to &Param1& x14"
    const eleanorUlt = parsePrimarySkillPart(combatDb['137'].ultimate, 'ultimate', 10);
    assert.equal(eleanorUlt?.mvPct, 328);
    assert.equal(eleanorUlt?.hits, 14);
    assert.equal(eleanorUlt?.damageType, 'Ultimate');

    // 161 Leafia Support Skill: classified as Auto Attack DMG
    const leafiaSup = parseSkillParts(combatDb['161'].supportSkill, 'supportSkill', 10);
    assert.equal(leafiaSup.length, 2);
    assert.ok(leafiaSup.every((p) => p.damageType === 'Auto Attack'));
  });
});
