import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import communityPresetsData from './fixtures/reference-presets.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import potentialsDbData from '../../../data/potentials-db.json' with { type: 'json' };
import {
  resolveCommunityPreset,
  type CommunityPresetEntry,
  type ResolvedCommunityPreset,
} from '../../community-presets.ts';
import type { SSCharacter, SSDisc, SSPotentialFull } from '../../../types/index.ts';
import type { CharacterCombatEntry } from '../fighter-calc.ts';
import {
  buildDiscRankingContext,
  DEFAULT_DISC_RANKING_ASSUMPTIONS,
} from '../disc-rankings.ts';
import {
  computeEstimatedEmblemRankings,
  computeEstimatedPotentialRankings,
  computeEstimatedSkillPlus3Matrix,
} from '../potential-emblem-rankings.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
const discs = discsData as unknown as Record<string, SSDisc>;
const potentialsDb = potentialsDbData as unknown as Record<string, SSPotentialFull[]>;
const presets = (communityPresetsData as unknown as CommunityPresetEntry[])
  .map((e) => resolveCommunityPreset(e))
  .filter((p): p is ResolvedCommunityPreset => p !== null);

describe('estimated potential rankings & +3 scaling engine', () => {
  it('returns non-empty finite potRank and potPlus3 rows for all 14 community presets', () => {
    assert.ok(presets.length >= 14);
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const res = computeEstimatedPotentialRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      assert.ok(res.potRank.length > 0, `Expected non-empty potRank for ${preset.id}`);
      assert.ok(res.potPlus3.length > 0, `Expected non-empty potPlus3 for ${preset.id}`);

      for (const row of res.potRank) {
        if (row.value !== null) {
          assert.ok(Number.isFinite(row.value), `Non-finite potRank on ${preset.id}:${row.name}`);
        }
      }
      for (const row of res.potPlus3) {
        if (row.teamDmg !== null) {
          assert.ok(Number.isFinite(row.teamDmg), `Non-finite potPlus3 teamDmg on ${preset.id}:${row.name}`);
        }
        if (row.personalDmg !== null) {
          assert.ok(Number.isFinite(row.personalDmg), `Non-finite potPlus3 personalDmg on ${preset.id}:${row.name}`);
        }
      }
    }
  });

  it('ranks Firstlight Noya Skill potentials accurately including hybrid extra-hit +3 gains', () => {
    const preset = presets.find((p) => p.id === 'firstlight-noya-skill')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const res = computeEstimatedPotentialRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

    const ecRank = res.potRank[0];
    assert.equal(ecRank.name, 'Enemy Counter');
    assert.ok(
      ecRank.value !== null && ecRank.value >= 30 && ecRank.value <= 55,
      `Expected Enemy Counter potRank in [30, 55], got ${ecRank.value}`
    );

    const ecPlus3 = res.potPlus3[0];
    assert.equal(ecPlus3.name, 'Enemy Counter');
    assert.ok(
      ecPlus3.teamDmg !== null && ecPlus3.teamDmg >= 9 && ecPlus3.teamDmg <= 16,
      `Expected Enemy Counter +3 teamDmg in [9, 16], got ${ecPlus3.teamDmg}`
    );
    assert.equal(ecPlus3.personalDmg, null);

    const prismPlus3 = res.potPlus3.find((r) => r.name === 'Prism Warp')!;
    assert.ok(
      prismPlus3.teamDmg !== null && prismPlus3.teamDmg >= 1.5,
      `Expected Prism Warp +3 teamDmg >= 1.5, got ${prismPlus3.teamDmg}`
    );
    assert.ok(
      prismPlus3.personalDmg !== null && prismPlus3.personalDmg >= 2.0,
      `Expected Prism Warp +3 personalDmg >= 2.0, got ${prismPlus3.personalDmg}`
    );

    const lucentPlus3 = res.potPlus3.find((r) => r.name === 'Lucent Tide')!;
    assert.ok(
      lucentPlus3.personalDmg !== null && Math.abs(lucentPlus3.personalDmg) < 0.05,
      `Expected Lucent Tide +3 personalDmg ~0, got ${lucentPlus3.personalDmg}`
    );
    assert.ok(
      lucentPlus3.teamDmg !== null && lucentPlus3.teamDmg > 0.2,
      `Expected Lucent Tide +3 teamDmg > 0.2, got ${lucentPlus3.teamDmg}`
    );

    const guidingRank = res.potRank.find((r) => r.name === 'Guiding Star')!;
    assert.ok(
      guidingRank.value !== null && guidingRank.value >= 8,
      `Expected Guiding Star potRank >= 8, got ${guidingRank.value}`
    );

    assert.equal(res.potPlus3[0].name, 'Enemy Counter');
    assert.equal(res.potPlus3[1].name, 'Domain of Purity');
    assert.equal(res.potPlus3[2].name, 'Stellar Crash');

    const astralRank = res.potRank.find((r) => r.name === 'Astral Brilliance')!;
    assert.ok(
      astralRank.value !== null && astralRank.value >= 14 && astralRank.value <= 19,
      `Expected Astral Brilliance potRank in [14, 19], got ${astralRank.value}`
    );
    const astralPlus3 = res.potPlus3.find((r) => r.name === 'Astral Brilliance')!;
    assert.ok(
      astralPlus3.teamDmg !== null && astralPlus3.teamDmg >= 3.2 && astralPlus3.teamDmg <= 4.4,
      `Expected Astral Brilliance +3 teamDmg in [3.2, 4.4], got ${astralPlus3.teamDmg}`
    );
    assert.ok(
      astralPlus3.personalDmg !== null && astralPlus3.personalDmg >= 4.5 && astralPlus3.personalDmg <= 5.1,
      `Expected Astral Brilliance +3 personalDmg in [4.5, 5.1], got ${astralPlus3.personalDmg}`
    );

    const bladePlus3 = res.potPlus3.find((r) => r.name === 'Blade of Falling Petals')!;
    assert.ok(
      bladePlus3.teamDmg !== null && bladePlus3.teamDmg <= 1.7,
      `Expected Blade of Falling Petals +3 teamDmg <= 1.7 under 0 Emblems, got ${bladePlus3.teamDmg}`
    );
    assert.ok(
      bladePlus3.personalDmg !== null && bladePlus3.personalDmg <= 5.5,
      `Expected Blade of Falling Petals +3 personalDmg <= 5.5, got ${bladePlus3.personalDmg}`
    );

    const lightforgedPlus3 = res.potPlus3.find((r) => r.name === 'Lightforged Blade')!;
    assert.ok(
      lightforgedPlus3.personalDmg !== null &&
        lightforgedPlus3.personalDmg >= 13.5 &&
        lightforgedPlus3.personalDmg <= 22.0,
      `Expected Lightforged Blade +3 personalDmg in [13.5, 22.0] under 0 Emblems, got ${lightforgedPlus3.personalDmg}`
    );

    // Toggling back to target Harmony + synthetic Emblems reproduces the earlier baseline range
    const legacySim = computeEstimatedPotentialRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      notesMode: 'target',
      emblemBaseline: 'synthetic',
    });
    const legacyAstral = legacySim.potRank.find((r) => r.name === 'Astral Brilliance')!;
    const legacyBlade = legacySim.potPlus3.find((r) => r.name === 'Blade of Falling Petals')!;
    const legacyLightforged = legacySim.potPlus3.find((r) => r.name === 'Lightforged Blade')!;
    assert.ok(
      legacyAstral.value !== null && legacyAstral.value >= 15 && legacyAstral.value <= 19,
      `Expected legacy target+synthetic Astral Brilliance in [15, 19], got ${legacyAstral.value}`
    );
    assert.ok(
      legacyBlade.teamDmg !== null && legacyBlade.teamDmg <= 1.4,
      `Expected legacy synthetic Blade of Falling Petals +3 teamDmg <= 1.4, got ${legacyBlade.teamDmg}`
    );
    assert.ok(
      legacyLightforged.personalDmg !== null && legacyLightforged.personalDmg <= 19.5,
      `Expected legacy synthetic Lightforged Blade +3 personalDmg <= 19.5, got ${legacyLightforged.personalDmg}`
    );

    const top5Names = res.potRank.slice(0, 5).map((r) => r.name);
    assert.ok(top5Names.includes('Domain of Purity'), `Expected Domain of Purity in top 5: ${top5Names}`);
    assert.ok(top5Names.includes('Stellar Crash'), `Expected Stellar Crash in top 5: ${top5Names}`);
  });

  it('evaluates Karin Ultimate Umbra calibration, Otoha sub-DPS personalDmg, and masks Cosette', () => {
    const preset = presets.find((p) => p.id === 'karin-ultimate-umbra')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const res = computeEstimatedPotentialRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const emb = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

    assert.equal(emb.length, 2, `Expected Karin + Otoha emblem columns, got ${emb.map((c) => c.label)}`);
    // Karin (4★ T5) now receives minor talent nodes (+400 Base ATK, +43% Ult) and Devouring Shadow's team DEF PEN 100, shifting Karin/Otoha share from ~65/35 to ~82/18.
    assert.ok(
      emb[0].dpsSharePct >= 60 && emb[0].dpsSharePct <= 85,
      `Expected Karin share in [60, 85]%, got ${emb[0].dpsSharePct}`
    );
    assert.ok(
      emb[1].dpsSharePct >= 15 && emb[1].dpsSharePct <= 39,
      `Expected Otoha share in [15, 39]%, got ${emb[1].dpsSharePct}`
    );

    const solitary = res.potPlus3.find((r) => r.name === 'Solitary Lantern')!;
    // teamDmg scales proportionally with Otoha's ~18% DPS share after Karin T5 minor nodes + Devouring Shadow team DEF PEN 100.
    assert.ok(
      solitary.teamDmg !== null && solitary.teamDmg >= 3.5 && solitary.teamDmg <= 14.5,
      `Expected Solitary Lantern +3 teamDmg in [3.5, 14.5], got ${solitary.teamDmg}`
    );
    assert.ok(
      solitary.personalDmg !== null && solitary.personalDmg >= 28 && solitary.personalDmg <= 42,
      `Expected Solitary Lantern +3 personalDmg in [28, 42], got ${solitary.personalDmg}`
    );

    const withoutTrace = res.potPlus3.find((r) => r.name === 'Without A Trace')!;
    assert.ok(
      withoutTrace.teamDmg !== null && withoutTrace.teamDmg >= 1.2 && withoutTrace.teamDmg <= 7.0,
      `Expected Without A Trace +3 teamDmg in [1.2, 7.0], got ${withoutTrace.teamDmg}`
    );
    assert.ok(
      withoutTrace.personalDmg !== null && withoutTrace.personalDmg >= 10 && withoutTrace.personalDmg <= 19,
      `Expected Without A Trace +3 personalDmg in [10, 19], got ${withoutTrace.personalDmg}`
    );

    for (const otohaPot of ['Solitary Lantern', 'Without A Trace', 'Murmur of Annihilation', 'Devouring Shadow']) {
      const row = res.potPlus3.find((r) => r.name === otohaPot)!;
      assert.notEqual(row.personalDmg, null, `Expected non-null personalDmg on Otoha ${otohaPot}`);
    }

    const crashingPlus3 = res.potPlus3.find((r) => r.name === 'Crashing Wave')!;
    assert.ok(
      crashingPlus3.teamDmg !== null && crashingPlus3.teamDmg >= 5.0 && crashingPlus3.teamDmg <= 8.5,
      `Expected Crashing Wave +3 teamDmg in [5.0, 8.5], got ${crashingPlus3.teamDmg}`
    );
    assert.ok(
      crashingPlus3.personalDmg !== null && crashingPlus3.personalDmg >= 4.0,
      `Expected Crashing Wave +3 personalDmg >= 4.0, got ${crashingPlus3.personalDmg}`
    );

    const netherPlus3 = res.potPlus3.find((r) => r.name === 'Nether Blaze')!;
    assert.ok(
      netherPlus3.teamDmg !== null && netherPlus3.teamDmg >= 4.5 && netherPlus3.teamDmg <= 7.5,
      `Expected Nether Blaze +3 teamDmg in [4.5, 7.5], got ${netherPlus3.teamDmg}`
    );

    const cosetteRows = res.potPlus3.filter((r) => r.slot === 'support');
    assert.ok(cosetteRows.length > 0);
    for (const row of cosetteRows) {
      assert.equal(row.personalDmg, null, `Expected null personalDmg for Cosette row ${row.name}`);
    }
  });

  it('captures Brilliant Relay, Engulfing Tide, Hovering Gale, and Piercing Trajectory across builds', () => {
    const checkPlus3 = (buildId: string, potName: string, minTeam: number) => {
      const preset = presets.find((p) => p.id === buildId)!;
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const res = computeEstimatedPotentialRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      const row = res.potPlus3.find((r) => r.name === potName)!;
      assert.ok(
        row.teamDmg !== null && row.teamDmg > minTeam,
        `Expected ${buildId} ${potName} +3 > ${minTeam}%, got ${row.teamDmg}`
      );
    };

    checkPlus3('chitose-mark-willow', 'Brilliant Relay', 0.5);
    checkPlus3('chitose-mark-willow', 'Engulfing Tide', 4.0);
    checkPlus3('chitose-mark-willow', 'Hovering Gale', 0.5);
    checkPlus3('allie-mark-teresa', 'Engulfing Tide', 4.0);
    checkPlus3('allie-mark-teresa', 'Hovering Gale', 0.5);
    checkPlus3('wraith-aa-eleanor', 'Piercing Trajectory', 0.5);
    checkPlus3('eleanor-aa-canace', 'Piercing Trajectory', 0.5);
  });

  it('marks pure cadence/mechanic potentials as mechanic with null numbers', () => {
    const preset = presets.find((p) => p.id === 'otoha-dps-mistique')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const res = computeEstimatedPotentialRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

    for (const name of ['The Conjuring', 'Twin Born']) {
      const rankRow = res.potRank.find((r) => r.name === name)!;
      assert.equal(rankRow.kind, 'mechanic');
      assert.equal(rankRow.value, null);
      const plus3Row = res.potPlus3.find((r) => r.name === name)!;
      assert.equal(plus3Row.kind, 'mechanic');
      assert.equal(plus3Row.teamDmg, null);
    }
  });

  it('shifts Lv 1 filler potentials when potentialLevelMode switches from preset to lv6', () => {
    const preset = presets.find((p) => p.id === 'firstlight-noya-skill')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const atPreset = computeEstimatedPotentialRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      potentialLevelMode: 'preset',
    });
    const atLv6 = computeEstimatedPotentialRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      potentialLevelMode: 'lv6',
    });

    for (const name of ['Blade of Falling Petals', "Knight's Seal"]) {
      const rPreset = atPreset.potRank.find((r) => r.name === name)!;
      const rLv6 = atLv6.potRank.find((r) => r.name === name)!;
      assert.equal(rPreset.baseLevel, 1);
      assert.equal(rLv6.baseLevel, 6);
      assert.notEqual(rPreset.value, rLv6.value);
    }
  });
});


describe('estimated emblem (personal damage) engine', () => {
  it('produces valid positive emblem columns for all 14 community presets', () => {
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const cols = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      assert.ok(cols.length >= 1, `Expected >=1 emblem column for ${preset.id}`);
      for (const col of cols) {
        assert.ok(col.rows.length >= 4, `Expected >=4 rows on ${preset.id}:${col.label}`);
        for (let i = 0; i < col.rows.length; i++) {
          const r = col.rows[i];
          assert.ok(Number.isFinite(r.dmgGain) && r.dmgGain > 0, `Invalid dmgGain on ${preset.id}:${col.label}:${r.stat}`);
          if (i > 0) {
            assert.ok(col.rows[i - 1].dmgGain >= r.dmgGain, `Rows not sorted on ${preset.id}:${col.label}`);
          }
        }
      }
    }
  });

  it('computes clean 0-emblem baseline for Firstlight Noya Skill (F.Noya + Firefly, no Tilia)', () => {
    const preset = presets.find((p) => p.id === 'firstlight-noya-skill')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const cols = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

    assert.equal(cols.length, 2, `Expected 2 columns (F.Noya + Firefly), got ${cols.map((c) => c.label)}`);
    assert.equal(cols[0].slot, 'vanguard');
    assert.equal(cols[1].slot, 'versatile');

    const noyaStats = new Map(cols[0].rows.map((r) => [r.stat, r]));
    assert.ok(noyaStats.has('12% HP'), 'Expected 12% HP on Firstlight Noya');
    assert.ok(!noyaStats.has('12% ATK%'), 'Firstlight Noya should not show 12% ATK%');
    const noyaPen215 = noyaStats.get('105 > 215 PEN');
    const noyaPen158 = noyaStats.get('105 > 158 PEN');
    assert.ok(
      noyaPen215 && Math.abs(noyaPen215.dmgGain - 8.65) <= 0.1,
      `Expected 105 > 215 PEN on F.Noya within 8.65 ± 0.1%, got ${noyaPen215?.dmgGain}`
    );
    assert.ok(
      noyaPen158 && Math.abs(noyaPen158.dmgGain - 5.49) <= 0.1,
      `Expected 105 > 158 PEN on F.Noya within 5.49 ± 0.1%, got ${noyaPen158?.dmgGain}`
    );
    assert.ok((noyaStats.get('Main Skill +3')?.dmgGain ?? 0) >= 8, 'Expected Main Skill +3 >= 8% on F.Noya');
    assert.ok(noyaStats.has('15% Crit'), 'Expected 15% Crit on F.Noya');

    const fireflyStats = new Map(cols[1].rows.map((r) => [r.stat, r]));
    const ffPen110 = fireflyStats.get('0 > 110 PEN');
    const ffPen53 = fireflyStats.get('0 > 53 PEN');
    const ffPen220 = fireflyStats.get('110 > 220 PEN');
    assert.ok(
      ffPen110 && Math.abs(ffPen110.dmgGain - 22.88) <= 0.1,
      `Expected Firefly 0 > 110 PEN within 22.88 ± 0.1% at Boss Blitz (250) RES, got ${ffPen110?.dmgGain}`
    );
    assert.ok(
      ffPen53 && Math.abs(ffPen53.dmgGain - 12.64) <= 0.1,
      `Expected Firefly 0 > 53 PEN within 12.64 ± 0.1%, got ${ffPen53?.dmgGain}`
    );
    assert.ok(
      ffPen220 && Math.abs(ffPen220.dmgGain - 8.12) <= 0.1,
      `Expected Firefly 110 > 220 PEN within 8.12 ± 0.1%, got ${ffPen220?.dmgGain}`
    );
    assert.equal(ffPen110.isRecommended, true);
    assert.ok(ffPen53 && ffPen53.isRecommended === false, '0 > 53 PEN must not be bolded when 0 > 110 PEN is bolded');
    assert.ok(fireflyStats.has('110 > 220 PEN'), 'Expected 110 > 220 PEN on Firefly');
    assert.ok((fireflyStats.get('Support Skill +3')?.dmgGain ?? 0) >= 12, 'Expected Support Skill +3 >= 12% on Firefly');
    assert.ok(fireflyStats.has('12% ATK%'), 'Expected 12% ATK% on Firefly');
  });

  it('scales Firefly 0 > 110 PEN cleanly across Enemy RES presets (neutral > boss-blitz > low)', () => {
    const preset = presets.find((p) => p.id === 'firstlight-noya-skill')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const colsNeutral = computeEstimatedEmblemRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      enemyRes: 'neutral',
    });
    const colsBlitz = computeEstimatedEmblemRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      enemyRes: 'boss-blitz',
    });
    const colsLow = computeEstimatedEmblemRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      enemyRes: 'low',
    });
    const ffNeutral = colsNeutral[1].rows.find((r) => r.stat === '0 > 110 PEN');
    const ffBlitz = colsBlitz[1].rows.find((r) => r.stat === '0 > 110 PEN');
    const ffLow = colsLow[1].rows.find((r) => r.stat === '0 > 110 PEN');
    assert.ok(ffNeutral && ffNeutral.dmgGain >= 20, `Expected Neutral 750 RES >= 20%, got ${ffNeutral?.dmgGain}`);
    assert.ok(ffBlitz && ffBlitz.dmgGain >= 20 && ffBlitz.dmgGain < ffNeutral.dmgGain);
    assert.ok(!ffLow || ffLow.dmgGain < 12, `Expected Low 0 RES < 12% (or omitted at 0%), got ${ffLow?.dmgGain}`);
  });

  it('scales Nether Blaze realistic uptime and aligns Karin Main Skill +3 > Ultimate +3', () => {
    const preset = presets.find((p) => p.id === 'karin-ultimate-umbra')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);

    const potReal = computeEstimatedPotentialRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      uptimeMode: 'realistic',
    });
    const potIdeal = computeEstimatedPotentialRankings(ctx, {
      ...DEFAULT_DISC_RANKING_ASSUMPTIONS,
      uptimeMode: 'ideal',
    });
    const netherReal = potReal.potPlus3.find((r) => r.name === 'Nether Blaze')!;
    const netherIdeal = potIdeal.potPlus3.find((r) => r.name === 'Nether Blaze')!;
    assert.ok(
      netherReal.teamDmg !== null && netherReal.teamDmg >= 4 && netherReal.teamDmg <= 9.5,
      `Expected realistic Nether Blaze +3 teamDmg in [4, 9.5]%, got ${netherReal.teamDmg}`
    );
    assert.ok(
      netherIdeal.teamDmg !== null && netherIdeal.teamDmg > netherReal.teamDmg * 1.8,
      `Expected ideal Nether Blaze +3 (${netherIdeal.teamDmg}) >> realistic (${netherReal.teamDmg})`
    );

    const emb = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const karinRows = new Map(emb[0].rows.map((r) => [r.stat, r.dmgGain]));
    const mainSkill = karinRows.get('Main Skill +3') ?? 0;
    const ult = karinRows.get('Ultimate +3') ?? 0;
    assert.ok(
      mainSkill >= 11 && mainSkill > ult * 3 && ult <= 4,
      `Expected Karin Main Skill +3 (${mainSkill}%) >> Ultimate +3 (${ult}%)`
    );
  });
});

describe('estimated Skill +3 gain matrix engine', () => {
  it('produces a valid 4-row Skill +3 matrix for all 14 community presets', () => {
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const matrix = computeEstimatedSkillPlus3Matrix(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

      assert.equal(matrix.trekkerColumns.length, 3, `Expected 3 Trekker columns on ${preset.id}`);
      assert.deepEqual(
        matrix.rows.map((r) => r.skill),
        ['AA', 'Main Skill', 'Support Skill', 'Ultimate']
      );

      let positiveCells = 0;
      for (const row of matrix.rows) {
        assert.equal(row.cells.length, 3);
        for (const cell of row.cells) {
          if (cell.value !== null) {
            assert.ok(
              Number.isFinite(cell.value) && cell.value > 0,
              `Invalid Skill +3 value on ${preset.id}:${row.skill}: ${cell.value}`
            );
            positiveCells++;
          }
        }
      }
      assert.ok(positiveCells >= 2, `Expected >=2 positive Skill +3 cells on ${preset.id}`);
    }
  });

  it('calibrates tightly against ZiLenTz karin-ultimate-umbra Skill +3 Gain Matrix (including Cosette Team buff)', () => {
    const preset = presets.find((p) => p.id === 'karin-ultimate-umbra')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
    const matrix = computeEstimatedSkillPlus3Matrix(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);

    assert.equal(matrix.trekkerColumns[0].label, 'Karin');
    assert.equal(matrix.trekkerColumns[1].label, 'Otoha');
    assert.equal(matrix.trekkerColumns[2].label, 'Cosette (Team)');

    const rowBySkill = new Map(matrix.rows.map((r) => [r.skill, r.cells]));
    const karinMain = rowBySkill.get('Main Skill')![0];
    const karinUlt = rowBySkill.get('Ultimate')![0];
    const otohaSup = rowBySkill.get('Support Skill')![1];
    const cosetteSup = rowBySkill.get('Support Skill')![2];

    assert.ok(karinMain.value !== null && karinMain.value >= 11 && karinMain.value <= 16);
    assert.equal(karinMain.highlight, 'rose');
    assert.ok(karinUlt.value !== null && karinUlt.value >= 1.5 && karinUlt.value <= 3.5);
    assert.ok(otohaSup.value !== null && otohaSup.value >= 8.5 && otohaSup.value <= 13.5);
    assert.equal(otohaSup.highlight, 'violet');
    assert.ok(
      cosetteSup.value !== null && Math.abs(cosetteSup.value - 3.8) <= 0.8,
      `Expected Cosette (Team) Support Skill +3 near ZiLenTz 3.80%, got ${cosetteSup.value}%`
    );
    assert.equal(cosetteSup.highlight, 'cyan');
  });

  it('attributes off-field AA to supportSkill (RC-2), aligns Emblem Skill +3 with Matrix (RC-6), and scales Hovering Gale Mark reaction (RC-4)', () => {
    // 1. RC-2: Eleanor (versatile) Support Skill +3 on wraith-aa-eleanor and eleanor-aa-canace >= 15%
    for (const id of ['wraith-aa-eleanor', 'eleanor-aa-canace']) {
      const preset = presets.find((p) => p.id === id)!;
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const matrix = computeEstimatedSkillPlus3Matrix(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      const emb = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      const supRow = matrix.rows.find((r) => r.skill === 'Support Skill')!;
      const eleanorMatrixCell = supRow.cells[1]?.value ?? 0;
      const eleanorEmbCol = emb.find((c) => c.slot === 'versatile')!;
      const eleanorEmbVal =
        eleanorEmbCol?.rows.find((r) => r.stat === 'Support Skill +3')?.dmgGain ?? 0;
      assert.ok(
        eleanorMatrixCell >= 15,
        `Expected ${id} Eleanor Support Skill +3 in Matrix >= 15%, got ${eleanorMatrixCell}%`
      );
      assert.ok(
        eleanorEmbVal >= 15,
        `Expected ${id} Eleanor Support Skill +3 in Emblems >= 15%, got ${eleanorEmbVal}%`
      );
    }

    // 2. RC-6: Across all 14 presets, Emblem Skill +3 rows match Skill +3 Matrix cells within ±0.02%
    const LABEL_TO_ROW: Record<string, string> = {
      'Auto Attack +3': 'AA',
      'Main Skill +3': 'Main Skill',
      'Support Skill +3': 'Support Skill',
      'Ultimate +3': 'Ultimate',
    };
    const SLOT_INDEX: Record<string, number> = { vanguard: 0, versatile: 1, support: 2 };
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs, potentialsDb);
      const matrix = computeEstimatedSkillPlus3Matrix(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      const emb = computeEstimatedEmblemRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      for (const col of emb) {
        const colIdx = SLOT_INDEX[col.slot];
        for (const row of col.rows) {
          const matrixSkillName = LABEL_TO_ROW[row.stat];
          if (!matrixSkillName) continue;
          const matrixCell = matrix.rows.find((r) => r.skill === matrixSkillName)?.cells[colIdx]?.value;
          assert.ok(
            matrixCell !== null && matrixCell !== undefined && Math.abs(row.dmgGain - matrixCell) <= 0.02,
            `${preset.id} ${col.label} ${row.stat}: Emblem (${row.dmgGain}%) != Matrix (${matrixCell}%)`
          );
        }
      }
    }

    // 3. RC-4: Hovering Gale on chitose-mark-willow (top 2 rank >= 30%, top 2 +3 >= 18%) & allie-mark-teresa (+3 >= 5%)
    const chitosePreset = presets.find((p) => p.id === 'chitose-mark-willow')!;
    const chitoseCtx = buildDiscRankingContext(chitosePreset, characters, combatDb, discs, potentialsDb);
    const chitosePot = computeEstimatedPotentialRankings(chitoseCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const hgRankIdx = chitosePot.potRank.findIndex((r) => r.name === 'Hovering Gale');
    const hgPlus3Idx = chitosePot.potPlus3.findIndex((r) => r.name === 'Hovering Gale');
    const hgRank = chitosePot.potRank[hgRankIdx];
    const hgPlus3 = chitosePot.potPlus3[hgPlus3Idx];
    assert.ok(
      hgRankIdx >= 0 && hgRankIdx <= 1 && (hgRank.value ?? 0) >= 30,
      `Expected Hovering Gale in top 2 potRank with >= 30%, got #${hgRankIdx + 1} (${hgRank?.value}%)`
    );
    assert.ok(
      hgPlus3Idx >= 0 && hgPlus3Idx <= 1 && (hgPlus3.teamDmg ?? 0) >= 18,
      `Expected Hovering Gale in top 2 potPlus3 with teamDmg >= 18%, got #${hgPlus3Idx + 1} (${hgPlus3?.teamDmg}%)`
    );

    const alliePreset = presets.find((p) => p.id === 'allie-mark-teresa')!;
    const allieCtx = buildDiscRankingContext(alliePreset, characters, combatDb, discs, potentialsDb);
    const alliePot = computeEstimatedPotentialRankings(allieCtx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const allieHg = alliePot.potPlus3.find((r) => r.name === 'Hovering Gale');
    assert.ok(
      allieHg && (allieHg.teamDmg ?? 0) >= 5,
      `Expected Hovering Gale +3 on allie-mark-teresa >= 5%, got ${allieHg?.teamDmg}%`
    );
  });
});
