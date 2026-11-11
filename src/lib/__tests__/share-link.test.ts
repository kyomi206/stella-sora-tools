import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import characters from '../../data/characters.json' with { type: 'json' };
import discs from '../../data/discs.json' with { type: 'json' };
import { compressBuild, compressAdvancedBuild } from '../utils.ts';
import {
  decompressBuild,
  decompressAdvancedBuild,
  MAX_ENCODED_LENGTH,
} from '../share-link.ts';
import { MUSICAL_NOTES } from '../../data/notes.ts';
import type { TeamBuild, AdvancedTeamBuild } from '../../types/index.ts';

describe('share-link validation', () => {
  it('round trip keeps a realistic basic build', () => {
    const build: TeamBuild = {
      id: 'default',
      name: 'Realistic Basic Squad',
      createdAt: 1731234567890,
      slots: {
        vanguard: {
          characterId: 103,
          potentials: [
            { id: 10301, rarity: 0, level: '5', priority: 'Core' },
            { id: 10302, rarity: 1, level: 6, priority: 'Medium' },
          ],
        },
        versatile: {
          characterId: 107,
          potentials: [
            { id: 10701, rarity: 2, level: '3', priority: 'Optional' },
          ],
        },
        support: {
          characterId: null,
          potentials: [],
        },
      },
    };

    const compressed = compressBuild(build);
    const decoded = decompressBuild(compressed, characters);
    assert.deepEqual(decoded, build);
  });

  it('round trip keeps a realistic advanced build', () => {
    const build: AdvancedTeamBuild = {
      id: 'default',
      name: 'Realistic Advanced Squad',
      createdAt: 1731234567890,
      slots: {
        vanguard: {
          characterId: 103,
          potentials: [
            { id: 10301, rarity: 0, level: '5', priority: 'Core' },
            { id: 10302, rarity: 1, level: 6, priority: 'Medium' },
          ],
        },
        versatile: {
          characterId: 107,
          potentials: [
            { id: 10701, rarity: 2, level: '3', priority: 'Optional' },
          ],
        },
        support: {
          characterId: null,
          potentials: [],
        },
      },
      mainDiscs: [
        { discId: 211001, crescendo: 3, level: 90 },
        { discId: 211002, crescendo: 1, level: 80 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: 211003, phase: 5, level: 80, crescendo: 2 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: {
        'Melody of Pummel': 15,
        'Melody of Luck': 8,
      },
    };

    const compressed = compressAdvancedBuild(build);
    const decoded = decompressAdvancedBuild(compressed, characters, discs);
    assert.deepEqual(decoded, build);
  });

  it('{"id":"x"} payload -> null', () => {
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({ id: 'x' }));
    assert.strictEqual(decompressBuild(payload, characters), null);
    assert.strictEqual(decompressAdvancedBuild(payload, characters, discs), null);
  });

  it('{"slots":1} payload -> null', () => {
    const payload = LZString.compressToEncodedURIComponent(JSON.stringify({ slots: 1 }));
    assert.strictEqual(decompressBuild(payload, characters), null);
    assert.strictEqual(decompressAdvancedBuild(payload, characters, discs), null);
  });

  it('garbage string -> null; "" -> null', () => {
    assert.strictEqual(decompressBuild('not-valid-lz-data!@#$', characters), null);
    assert.strictEqual(decompressBuild('', characters), null);
    assert.strictEqual(decompressAdvancedBuild('not-valid-lz-data!@#$', characters, discs), null);
    assert.strictEqual(decompressAdvancedBuild('', characters, discs), null);
  });

  it('oversize: string of MAX_ENCODED_LENGTH + 1 characters -> null', () => {
    const oversize = 'a'.repeat(MAX_ENCODED_LENGTH + 1);
    assert.strictEqual(decompressBuild(oversize, characters), null);
    assert.strictEqual(decompressAdvancedBuild(oversize, characters, discs), null);

    // Verify Step 1 largest build is below the cap
    const targetNotes: Record<string, number> = {};
    for (const note of MUSICAL_NOTES) {
      targetNotes[note.name] = 99;
    }
    const largestBuild: AdvancedTeamBuild = {
      id: 'default',
      name: 'Largest Advanced Squad Build Name',
      createdAt: 1731234567890,
      slots: {
        vanguard: {
          characterId: 103,
          potentials: Array.from({ length: 23 }, (_, i) => ({
            id: 10300 + i,
            rarity: i < 2 ? 0 : 1,
            level: '6',
            priority: i < 2 ? 'Core' : 'Medium',
          })),
        },
        versatile: {
          characterId: 107,
          potentials: Array.from({ length: 23 }, (_, i) => ({
            id: 10700 + i,
            rarity: i < 2 ? 0 : 1,
            level: '6',
            priority: i < 2 ? 'Core' : 'Medium',
          })),
        },
        support: {
          characterId: 108,
          potentials: Array.from({ length: 23 }, (_, i) => ({
            id: 10800 + i,
            rarity: i < 2 ? 0 : 1,
            level: '6',
            priority: i < 2 ? 'Core' : 'Medium',
          })),
        },
      },
      mainDiscs: [
        { discId: 211001, crescendo: 6, level: 90 },
        { discId: 211002, crescendo: 6, level: 90 },
        { discId: 211003, crescendo: 6, level: 90 },
      ],
      supportDiscs: [
        { discId: 211004, phase: 8, level: 90, crescendo: 6 },
        { discId: 211005, phase: 8, level: 90, crescendo: 6 },
        { discId: 211006, phase: 8, level: 90, crescendo: 6 },
      ],
      targetNotes,
    };

    const encodedLargest = compressAdvancedBuild(largestBuild);
    assert.ok(
      encodedLargest.length <= MAX_ENCODED_LENGTH,
      `Largest build encoded length (${encodedLargest.length}) must be <= MAX_ENCODED_LENGTH (${MAX_ENCODED_LENGTH})`
    );
  });

  it('unknown characterId empties only that slot', () => {
    const rawBuild = {
      id: 'default',
      name: 'Partial Bad Character',
      createdAt: 1731234567890,
      slots: {
        vanguard: {
          characterId: 999999,
          potentials: [{ id: 99901, rarity: 1 }],
        },
        versatile: {
          characterId: 103,
          potentials: [{ id: 10301, rarity: 0 }],
        },
        support: {
          characterId: null,
          potentials: [],
        },
      },
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(rawBuild));
    const decodedBasic = decompressBuild(compressed, characters);
    assert.ok(decodedBasic);
    assert.strictEqual(decodedBasic.slots.vanguard.characterId, null);
    assert.deepEqual(decodedBasic.slots.vanguard.potentials, []);
    assert.strictEqual(decodedBasic.slots.versatile.characterId, 103);
    assert.deepEqual(decodedBasic.slots.versatile.potentials, [{ id: 10301, rarity: 0 }]);

    const decodedAdvanced = decompressAdvancedBuild(compressed, characters, discs);
    assert.ok(decodedAdvanced);
    assert.strictEqual(decodedAdvanced.slots.vanguard.characterId, null);
    assert.deepEqual(decodedAdvanced.slots.vanguard.potentials, []);
    assert.strictEqual(decodedAdvanced.slots.versatile.characterId, 103);
    assert.deepEqual(decodedAdvanced.slots.versatile.potentials, [{ id: 10301, rarity: 0 }]);
  });

  it('unknown discId becomes null for a main and a support disc', () => {
    const rawBuild = {
      id: 'default',
      name: 'Partial Bad Discs',
      createdAt: 1731234567890,
      slots: {
        vanguard: { characterId: null, potentials: [] },
        versatile: { characterId: null, potentials: [] },
        support: { characterId: null, potentials: [] },
      },
      mainDiscs: [
        { discId: 999999, crescendo: 4, level: 90 },
        { discId: 211001, crescendo: 2, level: 80 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: 888888, phase: 6, level: 80, crescendo: 2 },
        { discId: 211002, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: {},
    };

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(rawBuild));
    const decoded = decompressAdvancedBuild(compressed, characters, discs);
    assert.ok(decoded);
    assert.strictEqual(decoded.mainDiscs[0].discId, null);
    assert.strictEqual(decoded.mainDiscs[0].crescendo, 4);
    assert.strictEqual(decoded.mainDiscs[0].level, 90);
    assert.strictEqual(decoded.mainDiscs[1].discId, 211001);

    assert.strictEqual(decoded.supportDiscs[0].discId, null);
    assert.strictEqual(decoded.supportDiscs[0].phase, 6);
    assert.strictEqual(decoded.supportDiscs[0].level, 80);
    assert.strictEqual(decoded.supportDiscs[0].crescendo, 2);
    assert.strictEqual(decoded.supportDiscs[1].discId, 211002);
  });

  it('targetNotes ignores __proto__ and constructor', () => {
    // Construct a raw JSON payload with prototype pollution attempt
    const jsonString = JSON.stringify({
      id: 'default',
      name: 'Security Test Squad',
      createdAt: 1731234567890,
      slots: {
        vanguard: { characterId: null, potentials: [] },
        versatile: { characterId: null, potentials: [] },
        support: { characterId: null, potentials: [] },
      },
      mainDiscs: [
        { discId: null, crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: JSON.parse('{"__proto__":{"polluted":true},"constructor":123,"Melody of Pummel":15}'),
    });

    const compressed = LZString.compressToEncodedURIComponent(jsonString);
    const decoded = decompressAdvancedBuild(compressed, characters, discs);
    assert.ok(decoded);

    // Verify pollution did not occur
    assert.strictEqual((Object.prototype as any).polluted, undefined);
    assert.strictEqual(({} as any).polluted, undefined);

    const keys = Object.keys(decoded.targetNotes);
    assert.ok(!keys.includes('__proto__'), 'targetNotes must not contain __proto__');
    assert.ok(!keys.includes('constructor'), 'targetNotes must not contain constructor');
    assert.strictEqual(decoded.targetNotes['Melody of Pummel'], 15);
  });
});
