import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import discsData from '../../data/discs.json' with { type: 'json' };
import { unpackAdvancedPresetCode, unpackPresetCode } from '../preset-code.ts';
import {
  deleteSavedPreset,
  duplicateSavedPreset,
  hasAnyBuildContent,
  MAX_BACKUP_JSON_LENGTH,
  MAX_PRESET_NAME_LENGTH,
  parsePresetsBackup,
  renameSavedPreset,
  serializePresetsBackup,
  upsertSavedPreset,
  type SavedPresetRecord,
} from '../saved-presets.ts';
import type { TeamBuild } from '../../types/index.ts';

function emptySlots(): TeamBuild['slots'] {
  return {
    vanguard: { characterId: null, potentials: [] },
    versatile: { characterId: null, potentials: [] },
    support: { characterId: null, potentials: [] },
  };
}

describe('saved-presets library helper', () => {
  const sampleDiscIds = Object.keys(discsData)
    .slice(0, 6)
    .map((id) => Number(id));
  const fullSlots = unpackPresetCode('AAAAkAAAAIIAAACgzbADDADNgBgMADAGw22A');
  assert.ok(fullSlots, 'Expected sample full preset code to unpack');

  it('rejects completely empty builds', () => {
    assert.strictEqual(hasAnyBuildContent({ slots: emptySlots() }), false);
    const res = upsertSavedPreset([], {
      name: 'Empty Build',
      mode: 'basic',
      slots: emptySlots(),
      now: 1000,
    });
    assert.strictEqual(res, null);
  });

  it('creates basic and advanced bookmarks with advCode and conditional inGameCode', () => {
    const partialSlots: TeamBuild['slots'] = {
      vanguard: { characterId: 144, potentials: [] },
      versatile: { characterId: null, potentials: [] },
      support: { characterId: null, potentials: [] },
    };

    const partialResult = upsertSavedPreset([], {
      name: '  Chitose Solo  ',
      mode: 'basic',
      slots: partialSlots,
      now: 1000,
    });
    assert.ok(partialResult);
    assert.strictEqual(partialResult.record.name, 'Chitose Solo');
    assert.strictEqual(partialResult.record.mode, 'basic');
    assert.strictEqual(partialResult.record.inGameCode, null);
    assert.ok(partialResult.record.advCode.startsWith('SST1'));

    const advResult = upsertSavedPreset(partialResult.list, {
      name: 'Aqua Blitz',
      mode: 'advanced',
      slots: fullSlots,
      mainDiscs: [
        { discId: sampleDiscIds[0], crescendo: 2, level: 90 },
        { discId: sampleDiscIds[1], crescendo: 1, level: 80 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: sampleDiscIds[2], phase: 6, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: { 'Melody of Aqua': 14 },
      now: 2000,
    });
    assert.ok(advResult);
    assert.strictEqual(advResult.list.length, 2);
    assert.strictEqual(advResult.list[0].id, advResult.record.id);
    assert.strictEqual(advResult.record.mode, 'advanced');
    assert.ok(advResult.record.inGameCode, 'Expected 36-char code when all 3 Trekkers exist');
    assert.strictEqual(advResult.record.inGameCode.length, 36);
  });

  it('preserves advanced Runic Discs and targetNotes when updating a bookmark from basic mode', () => {
    const created = upsertSavedPreset([], {
      name: 'Full Setup',
      mode: 'advanced',
      slots: fullSlots,
      mainDiscs: [
        { discId: sampleDiscIds[0], crescendo: 4, level: 90 },
        { discId: sampleDiscIds[1], crescendo: 3, level: 80 },
        { discId: sampleDiscIds[2], crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: sampleDiscIds[3], phase: 5, level: 80, crescendo: 2 },
        { discId: sampleDiscIds[4], phase: 8, level: 90, crescendo: 1 },
        { discId: sampleDiscIds[5], phase: 7, level: 1, crescendo: 6 },
      ],
      targetNotes: { 'Melody of Burst': 18, 'Melody of Aqua': 12 },
      now: 1000,
    });
    assert.ok(created);

    const swappedSlots: TeamBuild['slots'] = {
      ...fullSlots,
      vanguard: { ...fullSlots.vanguard, potentials: [] },
    };

    const updated = upsertSavedPreset(created.list, {
      id: created.record.id,
      name: 'Updated Squad Name',
      mode: 'basic',
      slots: swappedSlots,
      now: 2500,
    });
    assert.ok(updated);
    assert.strictEqual(updated.list.length, 1);
    assert.strictEqual(updated.record.id, created.record.id);
    assert.strictEqual(updated.record.mode, 'advanced');
    assert.strictEqual(updated.record.name, 'Updated Squad Name');
    assert.strictEqual(updated.record.createdAt, 1000);
    assert.strictEqual(updated.record.updatedAt, 2500);

    const unpacked = unpackAdvancedPresetCode(updated.record.advCode);
    assert.ok(unpacked);
    assert.strictEqual(unpacked.slots.vanguard.potentials.length, 0);
    assert.strictEqual(unpacked.mainDiscs[0].discId, sampleDiscIds[0]);
    assert.strictEqual(unpacked.mainDiscs[0].crescendo, 4);
    assert.strictEqual(unpacked.supportDiscs[0].discId, sampleDiscIds[3]);
    assert.strictEqual(unpacked.supportDiscs[0].phase, 5);
    assert.strictEqual(unpacked.targetNotes['Melody of Burst'], 18);
  });

  it('supports rename, duplicate, and delete deterministically', () => {
    const initial = upsertSavedPreset([], {
      name: 'Original Squad',
      mode: 'basic',
      slots: fullSlots,
      now: 1000,
    });
    assert.ok(initial);

    const renamed = renameSavedPreset(initial.list, initial.record.id, '  Renamed Squad ', 1500);
    assert.strictEqual(renamed[0].name, 'Renamed Squad');
    assert.strictEqual(renamed[0].updatedAt, 1500);

    // Blank rename is ignored
    const unchanged = renameSavedPreset(renamed, initial.record.id, '   ', 1800);
    assert.strictEqual(unchanged[0].name, 'Renamed Squad');

    const dup = duplicateSavedPreset(unchanged, initial.record.id, 2000);
    assert.ok(dup.duplicated);
    assert.strictEqual(dup.list.length, 2);
    assert.strictEqual(dup.duplicated.name, 'Renamed Squad (Copy)');
    assert.notStrictEqual(dup.duplicated.id, initial.record.id);

    const afterDelete = deleteSavedPreset(dup.list, initial.record.id);
    assert.strictEqual(afterDelete.length, 1);
    assert.strictEqual(afterDelete[0].id, dup.duplicated.id);
  });

  it('round-trips JSON backups, merges cleanly by ID, and rejects corrupted payloads', () => {
    const one = upsertSavedPreset([], {
      name: 'Squad One',
      mode: 'basic',
      slots: fullSlots,
      now: 1000,
    });
    const two = upsertSavedPreset(one!.list, {
      name: 'Squad Two',
      mode: 'advanced',
      slots: fullSlots,
      mainDiscs: [
        { discId: sampleDiscIds[0], crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      now: 2000,
    });
    assert.ok(two);

    const json = serializePresetsBackup(two.list);
    const parsedFresh = parsePresetsBackup(json, []);
    assert.ok(parsedFresh);
    assert.strictEqual(parsedFresh.importedCount, 2);
    assert.strictEqual(parsedFresh.list.length, 2);

    // Merging older duplicate shouldn't override newer existing record or create a duplicate ID
    const olderDuplicate: SavedPresetRecord[] = [
      { ...two.list[0], name: 'Stale Copy', updatedAt: 500 },
    ];
    const merged = parsePresetsBackup(JSON.stringify(olderDuplicate), two.list);
    assert.ok(merged);
    assert.strictEqual(merged.list.length, 2);
    assert.strictEqual(
      merged.list.find((r) => r.id === two.list[0].id)?.name,
      'Squad Two'
    );

    assert.strictEqual(parsePresetsBackup('{bad json', []), null);
    assert.strictEqual(parsePresetsBackup('{"version":1}', []), null);
    assert.strictEqual(
      parsePresetsBackup(JSON.stringify([{ id: 'bad', name: 'Broken', advCode: 'NOT_VALID' }]), []),
      null
    );
  });

  it('clamps extreme Unicode names safely without splitting surrogate pairs or stripping ZWNJ, and rejects oversized JSON backups', () => {
    const emojiBurst = '🔥'.repeat(100);
    const created = upsertSavedPreset([], {
      name: emojiBurst,
      mode: 'basic',
      slots: fullSlots,
      now: 1000,
    });
    assert.ok(created);
    assert.strictEqual(Array.from(created.record.name).length, MAX_PRESET_NAME_LENGTH);
    assert.strictEqual(created.record.name, '🔥'.repeat(MAX_PRESET_NAME_LENGTH));

    // Preserves ZWNJ (\u200C) and CJK characters while clamping to 80 code points
    const mixedName = `می\u200Cشود ${'千歳'.repeat(60)}`;
    const renamed = renameSavedPreset(created.list, created.record.id, mixedName, 2000);
    assert.ok(renamed[0].name.includes('\u200C'), 'Expected ZWNJ to be preserved');
    assert.strictEqual(Array.from(renamed[0].name).length, MAX_PRESET_NAME_LENGTH);

    // Rejects oversized payloads exceeding MAX_BACKUP_JSON_LENGTH cleanly
    const oversized = 'x'.repeat(MAX_BACKUP_JSON_LENGTH + 1);
    assert.strictEqual(parsePresetsBackup(oversized, []), null);
  });
});
