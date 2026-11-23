import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getResolvedCommunityPresets,
  type CommunityPresetEntry,
} from '../../community-presets.ts';
import { buildDiscRankingContext } from '../disc-rankings.ts';
import { DEFAULT_DISC_RANKING_ASSUMPTIONS } from '../disc-rankings-client.ts';
import { computeEstimatedTalentRankings } from '../potential-emblem-rankings.ts';
import type { SSCharacter, SSDisc } from '../../../types/index.ts';

type AllCombat = Parameters<typeof buildDiscRankingContext>[2];
type AllPotentials = NonNullable<Parameters<typeof buildDiscRankingContext>[4]>;

function loadJson<T>(relPath: string): T {
  const fullPath = path.resolve(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
}

const allCharacters = loadJson<Record<string, SSCharacter>>('src/data/characters.json');
const allCombat = loadJson<AllCombat>('src/data/character-combat.json');
const allDiscs = loadJson<Record<string, SSDisc>>('src/data/discs.json');
const allPotentials = loadJson<AllPotentials>('src/data/potentials-db.json');

const referencePresets = loadJson<CommunityPresetEntry[]>(
  'src/lib/calculator/__tests__/fixtures/reference-presets.json'
);

describe('estimated talent rankings engine (T1..T5 vs T0)', () => {
  const presets = getResolvedCommunityPresets(referencePresets);

  it('produces valid 5-tier TalentTrekkerTable entries for all 14 community presets', () => {
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(
        preset,
        allCharacters,
        allCombat,
        allDiscs,
        allPotentials
      );
      const tables = computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      assert.ok(tables.length >= 1 && tables.length <= 3, `${preset.id}: expected 1..3 tables`);

      for (const table of tables) {
        assert.equal(table.personalRelativeLabel, undefined);
        assert.deepEqual(
          table.tiers.map((t) => t.tier),
          [0, 1, 2, 3, 4, 5],
          `${preset.id} ${table.label}: expected tiers 0..5`
        );
        const t0 = table.tiers[0];
        assert.equal(t0.personalInc, 0);
        assert.equal(t0.personalRelativeInc, 0);
        assert.equal(t0.teamInc, 0);
        assert.equal(t0.teamRelativeInc, 0);
        assert.ok(Number.isInteger(t0.personalDmg) && t0.personalDmg > 0);
        assert.ok(Number.isInteger(t0.teamDmg) && t0.teamDmg > 0);

        for (let i = 0; i < table.tiers.length; i++) {
          const row = table.tiers[i];
          for (const v of [
            row.personalDmg,
            row.personalInc,
            row.personalRelativeInc,
            row.teamDmg,
            row.teamInc,
            row.teamRelativeInc,
          ]) {
            assert.ok(Number.isFinite(v), `${preset.id} ${table.label} T${row.tier}: non-finite`);
          }
          assert.ok(Number.isInteger(row.personalDmg) && row.personalDmg > 0);
          assert.ok(Number.isInteger(row.teamDmg) && row.teamDmg > 0);
          assert.ok(row.personalInc >= -0.01, `${preset.id} ${table.label} T${row.tier} personalInc < 0`);
          assert.ok(row.teamInc >= -0.01, `${preset.id} ${table.label} T${row.tier} teamInc < 0`);
          if (i > 0) {
            assert.ok(
              row.personalInc >= table.tiers[i - 1].personalInc - 0.05,
              `${preset.id} ${table.label}: personalInc non-monotonic at T${row.tier}`
            );
            assert.ok(
              row.teamInc >= table.tiers[i - 1].teamInc - 0.05,
              `${preset.id} ${table.label}: teamInc non-monotonic at T${row.tier}`
            );
          }
        }
      }
    }
  });

  it('produces strictly positive T5 gains for the primary carry across all 14 presets', () => {
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(
        preset,
        allCharacters,
        allCombat,
        allDiscs,
        allPotentials
      );
      const tables = computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      const carryId = ctx.roster.find((r) => r.slot === ctx.profile.carrySlot)?.character?.id;
      const carryTable = tables.find((t) => t.trekkerId === carryId) ?? tables[0];
      assert.ok(carryTable, `${preset.id}: missing carry talent table`);
      const t5 = carryTable.tiers[5];
      assert.ok(t5.personalInc > 0, `${preset.id}: expected carry T5 personalInc > 0, got ${t5.personalInc}`);
      assert.ok(t5.teamInc > 0, `${preset.id}: expected carry T5 teamInc > 0, got ${t5.teamInc}`);
    }
  });

  it('uses T0 as the 0% baseline even for 4-star Trekkers (e.g. Karin in karin-ultimate-umbra)', () => {
    const karinPreset = presets.find((p) => p.id === 'karin-ultimate-umbra')!;
    const ctx = buildDiscRankingContext(
      karinPreset,
      allCharacters,
      allCombat,
      allDiscs,
      allPotentials
    );
    const tables = computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const karinTable = tables.find((t) => t.trekkerId === 157);
    assert.ok(karinTable, 'Karin table should exist');
    assert.equal(karinTable.tiers[0].tier, 0);
    assert.equal(karinTable.tiers[0].personalInc, 0);
    assert.ok(karinTable.tiers[5].personalInc > karinTable.tiers[1].personalInc);
  });

  it('maintains internal consistency between cumulative teamInc and step-over-step teamRelativeInc', () => {
    const eleanorPreset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const ctx = buildDiscRankingContext(
      eleanorPreset,
      allCharacters,
      allCombat,
      allDiscs,
      allPotentials
    );
    const tables = computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const eleanor = tables[0];
    for (let i = 1; i < eleanor.tiers.length; i++) {
      const prev = eleanor.tiers[i - 1];
      const curr = eleanor.tiers[i];
      const expectedStepRel = ((1 + curr.teamInc / 100) / (1 + prev.teamInc / 100) - 1) * 100;
      assert.ok(
        Math.abs(curr.teamRelativeInc - expectedStepRel) <= 0.2,
        `T${curr.tier}: expected teamRelativeInc ~${expectedStepRel.toFixed(2)}, got ${curr.teamRelativeInc}`
      );
    }
  });

  it('handles a partial 1-Trekker squad cleanly without NaN', () => {
    const base = presets[0];
    const partialPreset = {
      ...base,
      id: 'partial-solo',
      advData: {
        ...base.advData,
        slots: {
          vanguard: base.advData.slots.vanguard,
          versatile: { characterId: null, potentials: [] },
          support: { characterId: null, potentials: [] },
        },
        mainDiscs: [
          { discId: null, crescendo: 1, level: 90 },
          { discId: null, crescendo: 1, level: 90 },
          { discId: null, crescendo: 1, level: 90 },
        ] as typeof base.advData.mainDiscs,
        supportDiscs: [
          { discId: null, phase: 8, level: 80, crescendo: 1 },
          { discId: null, phase: 8, level: 80, crescendo: 1 },
          { discId: null, phase: 8, level: 80, crescendo: 1 },
        ] as typeof base.advData.supportDiscs,
        notes: {},
      },
    };
    const ctx = buildDiscRankingContext(
      partialPreset,
      allCharacters,
      allCombat,
      allDiscs,
      allPotentials
    );
    const tables = computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    assert.equal(tables.length, 1);
    assert.equal(tables[0].tiers.length, 6);
    for (const row of tables[0].tiers) {
      assert.ok(Number.isFinite(row.personalDmg));
      assert.ok(Number.isFinite(row.teamDmg));
      assert.ok(Number.isFinite(row.personalInc));
      assert.ok(Number.isFinite(row.teamInc));
    }
  });
});
