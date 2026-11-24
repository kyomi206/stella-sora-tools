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

  it('gates Eleanor T2 Ventus Mark, scales Nazuka T1 realistic tornado uptime, scopes F.Noya T2/T5 DMG Multiplier, and uses Mistique T3 14% ATK%', () => {
    const eleanorWillow = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const ewCtx = buildDiscRankingContext(eleanorWillow, allCharacters, allCombat, allDiscs, allPotentials);
    const ewTables = computeEstimatedTalentRankings(ewCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const eleanorOnWillow = ewTables.find((t) => t.label === 'Eleanor')!;
    const nazukaOnWillow = ewTables.find((t) => t.label === 'Nazuka')!;

    // No Ventus Mark trigger in eleanor-skill-willow -> Eleanor T2 conditional ATK% skipped
    assert.ok(
      eleanorOnWillow.tiers[2].personalInc >= 14 && eleanorOnWillow.tiers[2].personalInc <= 24,
      `Expected Eleanor T2 personalInc in [14, 24]% without Ventus Mark trigger, got ${eleanorOnWillow.tiers[2].personalInc}%`
    );
    // Nazuka T1 tornado uptime (~22%) -> teamInc < 6% under realistic uptime
    assert.ok(
      nazukaOnWillow.tiers[1].teamInc < 6,
      `Expected Nazuka T1 realistic teamInc < 6%, got ${nazukaOnWillow.tiers[1].teamInc}%`
    );

    // Ideal uptime removes realisticUptime attenuation on Nazuka T1
    const ewIdeal = computeEstimatedTalentRankings(ewCtx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      uptimeMode: 'ideal',
    });
    const nazukaIdeal = ewIdeal.find((t) => t.label === 'Nazuka')!;
    assert.ok(
      nazukaIdeal.tiers[1].teamInc > nazukaOnWillow.tiers[1].teamInc * 2,
      `Expected Nazuka T1 ideal (${nazukaIdeal.tiers[1].teamInc}%) >> realistic (${nazukaOnWillow.tiers[1].teamInc}%)`
    );

    // Wraith + Eleanor + Ann has active Ventus Mark trigger -> Eleanor T2 conditional ATK% active
    const wraithEleanor = presets.find((p) => p.id === 'wraith-aa-eleanor')!;
    const weCtx = buildDiscRankingContext(wraithEleanor, allCharacters, allCombat, allDiscs, allPotentials);
    const weTables = computeEstimatedTalentRankings(weCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const eleanorOnWraith = weTables.find((t) => t.label === 'Eleanor')!;
    assert.ok(
      eleanorOnWraith.tiers[2].personalInc >= 24,
      `Expected Eleanor T2 personalInc >= 24% when Wraith triggers Ventus Mark, got ${eleanorOnWraith.tiers[2].personalInc}%`
    );

    // Firstlight Noya AA: T2/T5 exclude Mark damage
    const fnoyaAa = presets.find((p) => p.id === 'firstlight-noya-aa')!;
    const faCtx = buildDiscRankingContext(fnoyaAa, allCharacters, allCombat, allDiscs, allPotentials);
    const faTables = computeEstimatedTalentRankings(faCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const fnoyaTable = faTables.find((t) => t.label === 'Firstlight Noya')!;
    assert.ok(
      fnoyaTable.tiers[2].teamInc < 40,
      `Expected F.Noya AA T2 teamInc < 40%, got ${fnoyaTable.tiers[2].teamInc}%`
    );
    assert.ok(
      fnoyaTable.tiers[5].teamInc < 105,
      `Expected F.Noya AA T5 teamInc < 105%, got ${fnoyaTable.tiers[5].teamInc}%`
    );

    // Mistique T3 should grant +14% squad ATK% (4 * 3.5%), not +35%
    const otohaMistique = presets.find((p) => p.id === 'otoha-dps-mistique')!;
    const omCtx = buildDiscRankingContext(otohaMistique, allCharacters, allCombat, allDiscs, allPotentials);
    const omTables = computeEstimatedTalentRankings(omCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const mistiqueTable = omTables.find((t) => t.label === 'Mistique')!;
    assert.ok(
      mistiqueTable.tiers[3].teamRelativeInc < 7,
      `Expected Mistique T3 step gain < 7% (14% ATK%, not 35%), got ${mistiqueTable.tiers[3].teamRelativeInc}%`
    );
  });

  it('enforces extra deterministic talent squad gates (Nazuka T4, Tilia T4/T5, S.Willow T2, 3-element Support T5s, Otoha T3)', () => {
    const basePreset = presets[0];
    const cloneWithTeam = (vId: number, veId: number, suId: number) => {
      const cloned = {
        ...basePreset,
        id: `test-${vId}-${veId}-${suId}`,
        advData: {
          ...basePreset.advData,
          slots: {
            vanguard: { characterId: vId, potentials: [] },
            versatile: { characterId: veId, potentials: [] },
            support: { characterId: suId, potentials: [] },
          },
          notes: {},
        },
      };
      const ctx = buildDiscRankingContext(cloned, allCharacters, allCombat, allDiscs, allPotentials);
      return computeEstimatedTalentRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    };

    // 1. 3-same-element Support T5 gates (Tilia, Nazuna, Ann, Cosette, Flora, Teresa)
    const t5Cases: Array<{
      name: string;
      id: number;
      mixed: [number, number, number];
      mono: [number, number, number];
    }> = [
      { name: 'Tilia', id: 107, mixed: [134, 158, 107], mono: [162, 150, 107] },
      { name: 'Nazuna', id: 156, mixed: [134, 158, 156], mono: [161, 149, 156] },
      { name: 'Ann', id: 123, mixed: [134, 158, 123], mono: [119, 133, 123] },
      { name: 'Cosette', id: 142, mixed: [134, 158, 142], mono: [110, 145, 142] },
      { name: 'Flora', id: 126, mixed: [144, 127, 126], mono: [134, 158, 126] },
      { name: 'Teresa', id: 127, mixed: [134, 158, 127], mono: [144, 160, 127] },
    ];
    for (const tc of t5Cases) {
      const mixedRow = cloneWithTeam(...tc.mixed).find((t) => t.label === tc.name)!;
      const mixedTeammateDelta =
        mixedRow.tiers[5].teamDmg -
        mixedRow.tiers[5].personalDmg -
        (mixedRow.tiers[4].teamDmg - mixedRow.tiers[4].personalDmg);
      assert.equal(
        mixedTeammateDelta,
        0,
        `Expected ${tc.name} T5 Squad buff teammate delta === 0 in mixed squad, got ${mixedTeammateDelta}`
      );
      const monoRow = cloneWithTeam(...tc.mono).find((t) => t.label === tc.name)!;
      const monoTeammateDelta =
        monoRow.tiers[5].teamDmg -
        monoRow.tiers[5].personalDmg -
        (monoRow.tiers[4].teamDmg - monoRow.tiers[4].personalDmg);
      assert.ok(
        monoTeammateDelta > 0,
        `Expected ${tc.name} T5 Squad buff teammate delta > 0 in 3-element squad, got ${monoTeammateDelta}`
      );
    }

    // 2. Nazuka T4 gated on squad Ventus Mark trigger (minor stat node only ~5.6% vs minor +28% Skill >= 11%)
    const nazMixed = cloneWithTeam(134, 133, 126).find((t) => t.label === 'Nazuka')!;
    const nazVentus = cloneWithTeam(143, 133, 123).find((t) => t.label === 'Nazuka')!;
    assert.ok(
      nazMixed.tiers[4].personalRelativeInc < 8,
      `Expected Nazuka T4 personalRelativeInc < 8% (minor stats only, no +28% Skill) without Ventus Mark, got ${nazMixed.tiers[4].personalRelativeInc}%`
    );
    assert.ok(
      nazVentus.tiers[4].personalRelativeInc > nazMixed.tiers[4].personalRelativeInc + 5,
      `Expected Nazuka T4 personalRelativeInc (${nazVentus.tiers[4].personalRelativeInc}%) > no-Mark (${nazMixed.tiers[4].personalRelativeInc}%) + 5%`
    );

    // 3. Tilia T4 gated on squad Lux Mark trigger
    const tiliaNoMark = cloneWithTeam(144, 127, 107).find((t) => t.label === 'Tilia')!;
    const tiliaNoMarkMainDelta =
      tiliaNoMark.tiers[4].teamDmg -
      tiliaNoMark.tiers[4].personalDmg -
      (tiliaNoMark.tiers[3].teamDmg - tiliaNoMark.tiers[3].personalDmg);
    assert.equal(
      tiliaNoMarkMainDelta,
      0,
      `Expected Tilia T4 Main Ult buff delta === 0 without Lux Mark trigger, got ${tiliaNoMarkMainDelta}`
    );
    const tiliaWithMark = cloneWithTeam(162, 150, 107).find((t) => t.label === 'Tilia')!;
    const tiliaWithMarkMainDelta =
      tiliaWithMark.tiers[4].teamDmg -
      tiliaWithMark.tiers[4].personalDmg -
      (tiliaWithMark.tiers[3].teamDmg - tiliaWithMark.tiers[3].personalDmg);
    assert.ok(
      tiliaWithMarkMainDelta > 0,
      `Expected Tilia T4 Main Ult buff delta > 0 with Lux Mark trigger, got ${tiliaWithMarkMainDelta}`
    );

    // 4. Suntide Willow T2 gated on squad Aqua Mark trigger (teammate Aqua taken delta = 0 without Aqua Mark trigger)
    const willowNoMark = cloneWithTeam(134, 111, 160).find((t) => t.label === 'Suntide Willow')!;
    const willowNoMarkTeammateDelta =
      willowNoMark.tiers[2].teamDmg -
      willowNoMark.tiers[2].personalDmg -
      (willowNoMark.tiers[1].teamDmg - willowNoMark.tiers[1].personalDmg);
    assert.equal(
      willowNoMarkTeammateDelta,
      0,
      `Expected S.Willow T2 teammate delta === 0 without Aqua Mark trigger, got ${willowNoMarkTeammateDelta}`
    );
    const willowWithMark = cloneWithTeam(144, 127, 160).find((t) => t.label === 'Suntide Willow')!;
    const willowWithMarkTeammateDelta =
      willowWithMark.tiers[2].teamDmg -
      willowWithMark.tiers[2].personalDmg -
      (willowWithMark.tiers[1].teamDmg - willowWithMark.tiers[1].personalDmg);
    assert.ok(
      willowWithMarkTeammateDelta > 0,
      `Expected S.Willow T2 teammate delta > 0 with Aqua Mark trigger, got ${willowWithMarkTeammateDelta}`
    );

    // 5. Otoha T3 scopes +15% Crit DMG to Umbra teammates (not Ignis teammates)
    const otohaMixed = cloneWithTeam(134, 145, 126).find((t) => t.label === 'Otoha')!;
    const otohaT2NonSelf = otohaMixed.tiers[2].teamDmg - otohaMixed.tiers[2].personalDmg;
    const otohaT3NonSelf = otohaMixed.tiers[3].teamDmg - otohaMixed.tiers[3].personalDmg;
    assert.equal(
      otohaT3NonSelf,
      otohaT2NonSelf,
      `Expected Otoha T3 not to buff non-Umbra allies (T2 non-self=${otohaT2NonSelf}, T3=${otohaT3NonSelf})`
    );
    assert.ok(
      otohaMixed.tiers[3].personalRelativeInc > 0,
      `Expected Otoha T3 personalRelativeInc > 0 for Umbra Otoha, got ${otohaMixed.tiers[3].personalRelativeInc}%`
    );
  });
});
