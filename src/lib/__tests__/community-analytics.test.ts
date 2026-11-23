import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../data/characters.json' with { type: 'json' };
import communityPresetsData from '../../data/community-presets.json' with { type: 'json' };
import discsData from '../../data/discs.json' with { type: 'json' };
import analyticsData from '../../data/community-build-analytics.json' with { type: 'json' };
import {
  getCommunityBuildAnalytics,
  getHeatmapStyle,
  getPresetIdsWithAnalytics,
  type CommunityBuildAnalytics, type DiscRankRow,
} from '../community-analytics.ts';

function assertFiniteNonNegative(n: number | null | undefined, label: string) {
  if (n === null || n === undefined) return;
  assert.ok(typeof n === 'number' && Number.isFinite(n) && n >= 0, `Invalid numeric value for ${label}: ${String(n)}`);
}

describe('community-build-analytics dataset & helpers', () => {
  it('validates every preset key, discId, trekkerId, Talent T0-T5 ordering, and finite numbers', () => {
    const presetIds = new Set(
      (communityPresetsData as Array<{ id: string }>).map((p) => p.id)
    );
    const chars = charactersData as Record<string, { id: number; name: { EN: string } }>;
    const discs = discsData as Record<string, { id: number; name: string }>;
    const entries = Object.entries(analyticsData as Record<string, CommunityBuildAnalytics>);

    assert.ok(entries.length >= 3, 'Expected at least 3 pilot analytics entries');

    for (const [presetId, analytics] of entries) {
      assert.ok(presetIds.has(presetId), `Analytics key "${presetId}" does not match any preset in community-presets.json`);
      assert.deepStrictEqual(getCommunityBuildAnalytics(presetId), analytics);

      if (analytics.discRankings) {
        assert.ok(analytics.discRankings.metricLabel.length > 0, `Missing metricLabel on ${presetId}`);
        for (const group of ['main', 'support'] as const) {
          const rows: DiscRankRow[] = group === 'main' ? analytics.discRankings.main : analytics.discRankings.support;
          assert.ok(rows.length > 0, `Empty ${group} disc rankings on ${presetId}`);
          for (const row of rows) {
            assertFiniteNonNegative(row.value, `${presetId}.discRankings.${group}[${row.name}]`);
            if (row.discId !== undefined) {
              const disc = discs[String(row.discId)];
              assert.ok(disc, `Unknown discId ${row.discId} ("${row.name}") in ${presetId}`);
              assert.strictEqual(disc.name, row.name, `Disc name mismatch for discId ${row.discId} in ${presetId}`);
            }
          }
        }
      }

      if (analytics.skillPlus3) {
        for (const variant of analytics.skillPlus3) {
          assert.ok(variant.trekkerColumns.length > 0, `Empty trekkerColumns on ${presetId}`);
          for (const col of variant.trekkerColumns) {
            assert.ok(Object.prototype.hasOwnProperty.call(chars, String(col.trekkerId)), `Unknown trekkerId ${col.trekkerId} in skillPlus3 of ${presetId}`);
          }
          for (const row of variant.rows) {
            assert.strictEqual(row.cells.length, variant.trekkerColumns.length, `Skill +3 row cell length mismatch in ${presetId}`);
            for (const cell of row.cells) {
              assertFiniteNonNegative(cell.value, `${presetId}.skillPlus3[${row.skill}]`);
            }
          }
        }
      }

      if (analytics.potRank) {
        for (const row of analytics.potRank) {
          assert.ok(row.name.length > 0);
          assertFiniteNonNegative(row.value, `${presetId}.potRank[${row.name}]`);
        }
      }

      if (analytics.potPlus3) {
        for (const row of analytics.potPlus3) {
          assert.ok(row.name.length > 0);
          assertFiniteNonNegative(row.teamDmg, `${presetId}.potPlus3[${row.name}].teamDmg`);
          assertFiniteNonNegative(row.personalDmg, `${presetId}.potPlus3[${row.name}].personalDmg`);
        }
      }

      if (analytics.emblems) {
        for (const col of analytics.emblems) {
          assert.ok(Object.prototype.hasOwnProperty.call(chars, String(col.trekkerId)), `Unknown trekkerId ${col.trekkerId} in emblems of ${presetId}`);
          for (const row of col.rows) {
            assertFiniteNonNegative(row.dmgGain, `${presetId}.emblems[${col.label}][${row.stat}]`);
          }
        }
      }

      if (analytics.talents) {
        for (const table of analytics.talents) {
          assert.ok(Object.prototype.hasOwnProperty.call(chars, String(table.trekkerId)), `Unknown trekkerId ${table.trekkerId} in talents of ${presetId}`);
          assert.deepStrictEqual(
            table.tiers.map((t) => t.tier),
            [0, 1, 2, 3, 4, 5],
            `Talent tiers for ${table.label} in ${presetId} must cover 0..5 monotonically`
          );
          let prevPersonal = -1;
          let prevTeam = -1;
          for (const tier of table.tiers) {
            assertFiniteNonNegative(tier.personalDmg, `${presetId}.talents.${table.label}.T${tier.tier}.personalDmg`);
            assertFiniteNonNegative(tier.personalInc, `${presetId}.talents.${table.label}.T${tier.tier}.personalInc`);
            assertFiniteNonNegative(tier.personalRelativeInc, `${presetId}.talents.${table.label}.T${tier.tier}.personalRelativeInc`);
            assertFiniteNonNegative(tier.teamDmg, `${presetId}.talents.${table.label}.T${tier.tier}.teamDmg`);
            assertFiniteNonNegative(tier.teamInc, `${presetId}.talents.${table.label}.T${tier.tier}.teamInc`);
            assertFiniteNonNegative(tier.teamRelativeInc, `${presetId}.talents.${table.label}.T${tier.tier}.teamRelativeInc`);
            assert.ok(tier.personalDmg >= prevPersonal, `Non-monotonic personalDmg at T${tier.tier} in ${presetId}`);
            assert.ok(tier.teamDmg >= prevTeam, `Non-monotonic teamDmg at T${tier.tier} in ${presetId}`);
            prevPersonal = tier.personalDmg;
            prevTeam = tier.teamDmg;
          }
        }
      }
    }

    assert.strictEqual(getCommunityBuildAnalytics('nonexistent-preset'), null);
    assert.ok(getPresetIdsWithAnalytics().includes('eleanor-skill-willow'));
  });

  it('clamps heatmap alpha strictly within 0.08..0.40 and skips zero/invalid values', () => {
    assert.strictEqual(getHeatmapStyle(0, 100), undefined);
    assert.strictEqual(getHeatmapStyle(null, 100), undefined);
    assert.strictEqual(getHeatmapStyle(-5, 100), undefined);
    assert.strictEqual(getHeatmapStyle(50, 0), undefined);

    const low = getHeatmapStyle(0.01, 100, 'emerald');
    const high = getHeatmapStyle(100, 100, 'amber');
    assert.ok(low?.backgroundColor?.includes('0.08'));
    assert.ok(high?.backgroundColor?.includes('0.4)'));
  });
});
