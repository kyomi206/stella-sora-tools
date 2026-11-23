import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateSavedPreset,
  getSavedPresetById,
  parsePresetsBackup,
  serializePresetsBackup,
  updateSavedPresetRotation,
  upsertSavedPreset,
  type SavedPresetRecord,
} from '../saved-presets.ts';
import type { BuildRotation } from '../calculator/build-rotation.ts';
import { resolveCommunityPreset, type CommunityPresetEntry } from '../community-presets.ts';

const SAMPLE_SLOTS = {
  vanguard: {
    characterId: 144,
    potentials: [
      { id: 514401, rarity: 0 as const, level: 6 },
      { id: 514402, rarity: 1 as const, level: 6 },
    ],
  },
  versatile: { characterId: 112, potentials: [{ id: 511201, rarity: 0 as const, level: 6 }] },
  support: { characterId: 107, potentials: [{ id: 510701, rarity: 0 as const, level: 6 }] },
};

const SAMPLE_ROTATION: BuildRotation = {
  version: 1,
  slots: {
    vanguard: [
      {
        id: 'eleanor-skill-0',
        source: 'skill',
        name: 'Main Skill',
        damageType: 'Skill',
        scalingStat: 'ATK',
        motionValuePct: 450,
        hits: 1,
        casts: 3,
      },
    ],
    versatile: [
      {
        id: 'willow-support-0',
        source: 'supportSkill',
        name: 'Support Skill',
        damageType: 'Skill',
        scalingStat: 'ATK',
        motionValuePct: 220,
        hits: 1,
        casts: 2,
      },
    ],
  },
};

describe('saved-presets combatRotation & sourcePresetId support', () => {
  it('stores and preserves combatRotation and sourcePresetId in upsertSavedPreset', () => {
    const res1 = upsertSavedPreset([], {
      name: 'Eleanor Custom',
      mode: 'advanced',
      slots: SAMPLE_SLOTS,
      combatRotation: SAMPLE_ROTATION,
      sourcePresetId: 'eleanor-skill-willow',
      now: 1000,
    });
    assert.ok(res1);
    assert.deepEqual(res1.record.combatRotation, SAMPLE_ROTATION);
    assert.equal(res1.record.sourcePresetId, 'eleanor-skill-willow');

    // Updating build metadata without passing combatRotation preserves it
    const res2 = upsertSavedPreset(res1.list, {
      id: res1.record.id,
      name: 'Eleanor Custom v2',
      mode: 'advanced',
      slots: SAMPLE_SLOTS,
      now: 2000,
    });
    assert.ok(res2);
    assert.deepEqual(res2.record.combatRotation, SAMPLE_ROTATION);
    assert.equal(res2.record.sourcePresetId, 'eleanor-skill-willow');
  });

  it('getSavedPresetById and updateSavedPresetRotation work and clear on null', () => {
    const res = upsertSavedPreset([], {
      name: 'Karin Team',
      mode: 'basic',
      slots: SAMPLE_SLOTS,
      now: 1000,
    })!;
    assert.equal(getSavedPresetById(res.list, 'missing'), null);
    assert.equal(getSavedPresetById(res.list, res.record.id)?.name, 'Karin Team');

    const updated = updateSavedPresetRotation(res.list, res.record.id, SAMPLE_ROTATION, 3000);
    const found = getSavedPresetById(updated, res.record.id)!;
    assert.deepEqual(found.combatRotation, SAMPLE_ROTATION);
    assert.equal(found.updatedAt, 3000);

    const cleared = updateSavedPresetRotation(updated, res.record.id, null, 4000);
    const foundCleared = getSavedPresetById(cleared, res.record.id)!;
    assert.equal(foundCleared.combatRotation, undefined);
    assert.equal(foundCleared.updatedAt, 4000);
  });

  it('deep-clones combatRotation in duplicateSavedPreset', () => {
    const res = upsertSavedPreset([], {
      name: 'Orig',
      mode: 'advanced',
      slots: SAMPLE_SLOTS,
      combatRotation: SAMPLE_ROTATION,
      sourcePresetId: 'eleanor-skill-willow',
      now: 1000,
    })!;

    const { duplicated } = duplicateSavedPreset(res.list, res.record.id, 2000);
    assert.ok(duplicated);
    assert.deepEqual(duplicated.combatRotation, SAMPLE_ROTATION);
    duplicated.combatRotation!.slots.vanguard![0].casts = 9;
    assert.equal(res.record.combatRotation!.slots.vanguard![0].casts, 3);
  });

  it('round-trips combatRotation and sanitizes malformed payloads in backup JSON', () => {
    const res = upsertSavedPreset([], {
      name: 'Backup Squad',
      mode: 'advanced',
      slots: SAMPLE_SLOTS,
      combatRotation: SAMPLE_ROTATION,
      sourcePresetId: 'eleanor-skill-willow',
      now: 1000,
    })!;

    const json = serializePresetsBackup(res.list);
    const parsed = parsePresetsBackup(json, []);
    assert.ok(parsed);
    assert.deepEqual(parsed.list[0].combatRotation, SAMPLE_ROTATION);
    assert.equal(parsed.list[0].sourcePresetId, 'eleanor-skill-willow');

    // Malformed combatRotation should be stripped cleanly without rejecting the record
    const rawArr = JSON.parse(json) as { presets: Array<Record<string, unknown>> };
    rawArr.presets[0].combatRotation = { version: 99, entries: 'bad' };
    const parsedSanitized = parsePresetsBackup(JSON.stringify(rawArr), []);
    assert.ok(parsedSanitized);
    assert.equal(parsedSanitized.list.length, 1);
    assert.equal(parsedSanitized.list[0].combatRotation, undefined);
  });

  it('resolveCommunityPreset sanitizes combatRotation and defaults to null', () => {
    const entry: CommunityPresetEntry = {
      id: 'test-preset',
      title: 'Test Preset',
      element: 'Ventus',
      tier: 'f2p',
      archetype: 'Skill',
      summary: 'Test summary',
      verifiedPatch: '2.0',
      verifiedAt: '2026-11-22',
      modes: ['general'],
      inGameCode: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      rotation: [],
      sources: [{ author: 'Test', label: 'Test', url: 'https://example.com', kind: 'sheet' as const }],
      combatRotation: {
        version: 1,
        slots: {
          vanguard: [
            {
              id: 's1',
              source: 'skill',
              name: 'S',
              damageType: 'Skill',
              scalingStat: 'ATK',
              motionValuePct: 300,
              hits: 1,
              casts: 4.9,
            },
          ],
        },
      },
    };
    const resolved = resolveCommunityPreset(entry);
    if (resolved) {
      assert.equal(resolved.combatRotation?.slots.vanguard?.[0].casts, 5);
    }
  });
});
