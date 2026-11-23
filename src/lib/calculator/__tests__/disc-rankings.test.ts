import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import characterCombatData from '../../../data/character-combat.json' with { type: 'json' };
import communityAnalyticsData from '../../../data/community-build-analytics.json' with { type: 'json' };
import communityPresetsData from '../../../data/community-presets.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import {
  resolveCommunityPreset,
  type CommunityPresetEntry,
  type ResolvedCommunityPreset,
} from '../../community-presets.ts';
import type { CommunityBuildAnalytics } from '../../community-analytics-utils.ts';
import type { SSCharacter, SSDisc } from '../../../types/index.ts';
import type { CharacterCombatEntry } from '../fighter-calc.ts';
import {
  buildDiscRankingContext,
  computeEstimatedDiscRankings,
  DEFAULT_DISC_RANKING_ASSUMPTIONS,
} from '../disc-rankings.ts';
import { extractDiscPresetBuffs } from '../preset-buffs.ts';

const characters = charactersData as unknown as Record<string, SSCharacter>;
const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
const discs = discsData as unknown as Record<string, SSDisc>;
const presets = (communityPresetsData as unknown as CommunityPresetEntry[])
  .map((e) => resolveCommunityPreset(e))
  .filter((p): p is ResolvedCommunityPreset => p !== null);
const analytics = communityAnalyticsData as unknown as Record<string, CommunityBuildAnalytics>;

describe('estimated disc rankings engine & calibration', () => {
  it('propagates mainSkill named stack caps to Harmony skills and gates Main-element triggers', () => {
    // Petals of Blooming Mirage (214045): Dark Sakura stacks up to 20 -> H1 ultTaken must scale x20
    const karinRoster = [
      { slot: 'vanguard' as const, character: characters['155'] }, // Karin (Umbra)
      { slot: 'versatile' as const, character: characters['159'] }, // Otoha (Umbra)
      { slot: 'support' as const, character: characters['118'] }, // Cosette (Umbra)
    ];
    const petalsBuffs = extractDiscPresetBuffs(
      [{ discId: 214045, level: 90, crescendo: 6 }],
      {},
      discs,
      karinRoster,
      undefined,
      { enforceTriggers: true, forceHarmonyLevel: 5 }
    );
    const ultTaken = petalsBuffs.find((b) => b.origin === 'harmony' && b.stat === 'ultTaken');
    assert.ok(ultTaken, 'Expected Petals H1 ultTaken buff');
    assert.equal(ultTaken.stacks, 20);
    assert.equal(ultTaken.value, 20);

    // Chronicles of Spring (214016): requires Ventus Main Trekker -> blocked when Suntide Willow (Aqua) is Main
    const eleanorPreset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const eleanorRoster = (['vanguard', 'versatile', 'support'] as const).map((slot) => ({
      slot,
      character: characters[String(eleanorPreset.advData.slots[slot].characterId)] || null,
    }));
    const chronBuffs = extractDiscPresetBuffs(
      [{ discId: 214016, level: 90, crescendo: 6 }],
      eleanorPreset.advData.targetNotes,
      discs,
      eleanorRoster,
      undefined,
      { enforceTriggers: true, fightMode: 'single', uptimeMode: 'realistic' }
    );
    assert.ok(
      !chronBuffs.some((b) => b.stat === 'skillTaken' || b.stat === 'aaTaken'),
      'Drifting Snow debuffs must not proc when Main Trekker is Aqua'
    );
  });

  it('produces valid, sorted, finite Main & Support rankings for all 14 community builds', () => {
    assert.ok(presets.length >= 14);
    for (const preset of presets) {
      const ctx = buildDiscRankingContext(preset, characters, combatDb, discs);
      const serializedBytes = JSON.stringify(ctx).length;
      assert.ok(
        serializedBytes < 85_000,
        `Expected compact server-sliced context for ${preset.id}, got ${serializedBytes} bytes`
      );

      const res = computeEstimatedDiscRankings(ctx, DEFAULT_DISC_RANKING_ASSUMPTIONS);
      assert.equal(res.metricLabel, 'Dmg Inc');
      assert.ok(res.main.length >= 10, `Expected >=10 main disc rows on ${preset.id}`);
      assert.ok(res.support.length >= 8, `Expected >=8 support disc rows on ${preset.id}`);

      const seenMain = new Set<string>();
      for (let i = 0; i < res.main.length; i++) {
        const row = res.main[i];
        assert.ok(Number.isFinite(row.value), `Non-finite main value on ${preset.id}:${row.name}`);
        const key = `${row.discId}:${row.dupe}`;
        assert.ok(!seenMain.has(key), `Duplicate main row ${key} on ${preset.id}`);
        seenMain.add(key);
        if (i > 0) {
          assert.ok(res.main[i - 1].value >= row.value, `Main rows not sorted on ${preset.id}`);
        }
      }

      const equippedMainIds = new Set(ctx.mainDiscs.map((m) => m.discId).filter(Boolean));
      for (const row of res.support) {
        assert.ok(Number.isFinite(row.value), `Non-finite support value on ${preset.id}:${row.name}`);
        if (row.discId) {
          assert.ok(
            !equippedMainIds.has(row.discId),
            `Equipped Main disc ${row.discId} should not double-stack in Support table on ${preset.id}`
          );
        }
      }
      assert.equal(res.support[res.support.length - 1]?.name, '1 Empty Slot');
      assert.equal(res.support[res.support.length - 1]?.value, 0);
    }
  });

  it('calibrates tightly against ZiLenTz Eleanor Skill sheet (Support rank order + Main top 3)', () => {
    const preset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs);
    const est = computeEstimatedDiscRankings(ctx);
    const sheet = analytics['eleanor-skill-willow'].discRankings!;

    // Top 3 Main Discs match ZiLenTz's exact top 3: Deer's Song C6, Deer's Song C1, Fly O Caged Bird C6
    assert.deepEqual(
      est.main.slice(0, 3).map((r) => `${r.discId}:${r.dupe}`),
      sheet.main.slice(0, 3).map((r) => `${r.discId}:${r.dupe}`)
    );

    const estMainByKey = new Map(est.main.map((r) => [`${r.discId}:${r.dupe}`, r.value]));
    for (const key of ['214015:C6', '214015:C1', '214059:C6', '214059:C1', '214002:C6', '214024:C6']) {
      const sheetRow = sheet.main.find((r) => `${r.discId}:${r.dupe}` === key)!;
      const estVal = estMainByKey.get(key)!;
      // Foam Echo (+74.4% ATK% to non-Aqua squadmates) now applies to Eleanor, shifting Deer's Song C6 from ~71.5% to ~69.7% (within 4.8% of 74.37%).
      assert.ok(
        Math.abs(estVal - sheetRow.value) <= 5.1,
        `Eleanor Main ${sheetRow.name} ${sheetRow.dupe}: expected ${estVal}% within 5.1% of ${sheetRow.value}%`
      );
    }

    // Support Disc #1/#2 must be Sunlit Blossom C6/C1, within 2.5% of ZiLenTz
    assert.equal(est.support[0].discId, 214005);
    assert.equal(est.support[0].dupe, 'C6');
    assert.equal(est.support[1].discId, 214005);
    assert.equal(est.support[1].dupe, 'C1');
    assert.ok(Math.abs(est.support[0].value - 18.57) <= 2.5);
  });

  it('responds deterministically to every user-facing assumption toggle', () => {
    const preset = presets.find((p) => p.id === 'eleanor-skill-willow')!;
    const ctx = buildDiscRankingContext(preset, characters, combatDb, discs);

    const single = computeEstimatedDiscRankings(ctx, { fightMode: 'single' });
    const multi = computeEstimatedDiscRankings(ctx, { fightMode: 'multi' });
    const lemonSingle = single.main.find((r) => r.discId === 214018 && r.dupe === 'C6')!.value;
    const lemonMulti = multi.main.find((r) => r.discId === 214018 && r.dupe === 'C6')!.value;
    assert.ok(
      lemonMulti > lemonSingle,
      `Mobbing mode should increase Lemon & Black Tea kill-stack value (${lemonMulti} > ${lemonSingle})`
    );

    const realistic = computeEstimatedDiscRankings(ctx, { uptimeMode: 'realistic' });
    const ideal = computeEstimatedDiscRankings(ctx, { uptimeMode: 'ideal' });
    const jumpReal = realistic.main.find((r) => r.discId === 214024 && r.dupe === 'C6')!.value;
    const jumpIdeal = ideal.main.find((r) => r.discId === 214024 && r.dupe === 'C6')!.value;
    assert.ok(
      jumpIdeal > jumpReal + 10,
      `Ideal 100% uptime should increase One, Two, Three, Jump! (${jumpIdeal} > ${jumpReal})`
    );

    const startNotes = computeEstimatedDiscRankings(ctx, { notesMode: 'starting' });
    const maxHarmony = computeEstimatedDiscRankings(ctx, { notesMode: 'max-harmony' });
    const deerStart = startNotes.main.find((r) => r.discId === 214015 && r.dupe === 'C6')!.value;
    const deerMax = maxHarmony.main.find((r) => r.discId === 214015 && r.dupe === 'C6')!.value;
    assert.ok(
      deerMax > deerStart,
      `Max Harmony should increase Deer's Song over Starting Notes (${deerMax} > ${deerStart})`
    );

    // Compare vs replacing Slot 1 (Deer's Song C1): Deer's Song C1 must equal 0.00%, C6 must be positive
    const vsSlot1 = computeEstimatedDiscRankings(ctx, { compareBaseline: 'slot-1' });
    assert.equal(vsSlot1.metricLabel, 'vs Equipped');
    assert.equal(vsSlot1.baselineDiscName, "Deer's Song");
    const deerC1VsSelf = vsSlot1.main.find((r) => r.discId === 214015 && r.dupe === 'C1')!;
    const deerC6VsC1 = vsSlot1.main.find((r) => r.discId === 214015 && r.dupe === 'C6')!;
    assert.equal(deerC1VsSelf.value, 0);
    assert.ok(deerC6VsC1.value > 15);
    // Other equipped Main discs (Slot 0 Fly O Caged Bird, Slot 2 Lemon & Black Tea) should not duplicate into Slot 1
    assert.ok(!vsSlot1.main.some((r) => r.discId === 214059));
    assert.ok(!vsSlot1.main.some((r) => r.discId === 214018));

    // Slot Context toggle: Isolated (Sheet) evaluates against 2x Off-Element blank discs
    const equippedCtx = computeEstimatedDiscRankings(ctx, { baselineContext: 'equipped' });
    const isolatedCtx = computeEstimatedDiscRankings(ctx, { baselineContext: 'isolated' });
    const deerEq = equippedCtx.main.find((r) => r.discId === 214015 && r.dupe === 'C6')!.value;
    const deerIso = isolatedCtx.main.find((r) => r.discId === 214015 && r.dupe === 'C6')!.value;
    assert.ok(
      deerIso > deerEq,
      `Isolated (Sheet) mode should yield higher relative gain without diminishing returns from other Main discs (${deerIso} > ${deerEq})`
    );
  });

  it('handles HP-scaling carries (Firstlight Noya), Versatile-only stacks, and split-source Starwish x3', () => {
    const noyaPreset = presets.find((p) => p.id === 'firstlight-noya-skill')!;
    const ctx = buildDiscRankingContext(noyaPreset, characters, combatDb, discs);

    // Fix #1: Firstlight Noya auto-detected as HP scaler; Firefly & Tilia remain ATK
    assert.equal(ctx.roster.find((r) => r.slot === 'vanguard')?.combat?.scalingStat, 'HP');
    assert.equal(ctx.roster.find((r) => r.slot === 'versatile')?.combat?.scalingStat, 'ATK');

    const roster = ctx.roster.map((r) => ({ slot: r.slot, character: r.character }));

    // Fix #3: Stellar Destination Sync Rate targets versatile ONLY (never leaks onto Noya/team)
    const sdBuffs = extractDiscPresetBuffs(
      [{ discId: 214051, level: 90, crescendo: 6 }],
      ctx.targetNotes,
      discs,
      roster,
      undefined,
      { enforceTriggers: true, fightMode: 'single', uptimeMode: 'realistic' }
    );
    const syncLux = sdBuffs.find((b) => b.origin === 'melody' && b.stat === 'elementDmg');
    const syncCrit = sdBuffs.find((b) => b.origin === 'harmony' && b.stat === 'critDmg');
    assert.equal(syncLux?.target, 'versatile');
    assert.equal(syncCrit?.target, 'versatile');

    // Fix #4: My Guiding Star Starwish sums to 3 stacks across Melody + H1 + H2
    const mgsBuffs = extractDiscPresetBuffs(
      [{ discId: 214066, level: 90, crescendo: 6 }],
      ctx.targetNotes,
      discs,
      roster,
      undefined,
      { enforceTriggers: true, fightMode: 'single', uptimeMode: 'realistic' }
    );
    const starwishSkill = mgsBuffs.find((b) => b.origin === 'harmony' && b.stat === 'skillDmg');
    const starwishCrit = mgsBuffs.find((b) => b.origin === 'harmony' && b.stat === 'skillCritDmg');
    assert.equal(starwishSkill?.stacks, 3);
    assert.equal(starwishCrit?.stacks, 3);

    // Isolated (Sheet) calibration against Firstlight Noya Skill sheet
    const iso = computeEstimatedDiscRankings(ctx, { baselineContext: 'isolated' });
    assert.equal(iso.main[0].discId, 214066); // My Guiding Star C6 #1
    assert.equal(iso.main[0].dupe, 'C6');
    assert.ok(iso.main[0].value >= 95 && iso.main[0].value <= 125, `Expected My Guiding Star C6 near sheet 115%, got ${iso.main[0].value}%`);

    // Support Discs: Sunlit Blossom #1, Off-Element ATK 1,492 small (~1-3%, not ~8% like ATK carries)
    assert.equal(iso.support[0].discId, 214005);
    const offEl = iso.support.find((r) => r.name === 'Off-Element (Atk 1,492)')!;
    assert.ok(offEl.value >= 1 && offEl.value <= 3.5, `Expected Off-Element ATK 1,492 near 1.76% on HP carry, got ${offEl.value}%`);
  });
});
