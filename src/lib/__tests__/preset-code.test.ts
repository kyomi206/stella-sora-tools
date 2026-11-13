import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import discsData from '../../data/discs.json' with { type: 'json' };
import { getCharacterPotentials } from '../potentials.ts';
import {
  unpackPresetCode,
  packPresetCode,
  normalizePresetCodeInput,
  packAdvancedPresetCode,
  unpackAdvancedPresetCode,
  normalizeAdvancedPresetCodeInput,
  type AdvancedPresetData,
} from '../preset-code.ts';
import type { TeamBuild } from '../../types/index.ts';

const SAMPLE_CODES = [
  {
    code: 'AAAAbgAAAJEAAACOzbAYAAbNgBsAAGwAwAwA',
    charIds: [110, 145, 142],
  },
  {
    code: 'AAAAbgAAAJEAAACOzbAYAAYwBhtgAGwAwAwA',
    charIds: [110, 145, 142],
  },
  {
    code: 'AAAAkAAAAIIAAACgzbADDADNgBgMADAGw22A',
    charIds: [144, 130, 160],
  },
  {
    code: 'AAAAkAAAAKAAAAB9zbALDAAwBsNsAGwA2GwA',
    charIds: [144, 160, 125],
  },
  {
    code: 'AAAAiwAAAIIAAACgzbADAAbNgBgMADAGwGwG',
    charIds: [139, 130, 160],
  },
];

describe('Stella Sora preset code codec', () => {
  it('unpacks and round-trips all community preset codes identically', () => {
    for (const { code, charIds } of SAMPLE_CODES) {
      const slots = unpackPresetCode(code);
      assert.ok(slots, `Expected ${code} to unpack`);
      assert.strictEqual(slots.vanguard.characterId, charIds[0]);
      assert.strictEqual(slots.versatile.characterId, charIds[1]);
      assert.strictEqual(slots.support.characterId, charIds[2]);
      assert.ok(slots.vanguard.potentials.length > 0);
      assert.ok(slots.versatile.potentials.length > 0);
      assert.ok(slots.support.potentials.length > 0);

      const repacked = packPresetCode(slots);
      assert.strictEqual(repacked, code);
    }
  });

  it('preserves non-6 potential levels (e.g. Waltz of Ripples Lv.2)', () => {
    const slots = unpackPresetCode('AAAAkAAAAKAAAAB9zbALDAAwBsNsAGwA2GwA');
    assert.ok(slots);
    const waltz = slots.vanguard.potentials.find((p) => p.id === 514411);
    assert.ok(waltz);
    assert.strictEqual(waltz.level, 2);
  });

  it('normalizes stelladb build URLs, parentheses, and whitespace', () => {
    const raw = '  https://stelladb.pages.dev/build/AAAAbgAAAJEAAACOzbAYAAbNgBsAAGwAwAwA  ';
    assert.strictEqual(
      normalizePresetCodeInput(raw),
      'AAAAbgAAAJEAAACOzbAYAAbNgBsAAGwAwAwA'
    );
    const slots = unpackPresetCode(raw);
    assert.ok(slots);
    assert.strictEqual(slots.vanguard.characterId, 110);

    const parenthesized = ' (AAAAiwAAAIIAAACgzbADAAbNgBgMADAGwGwG) ';
    assert.strictEqual(
      normalizePresetCodeInput(parenthesized),
      'AAAAiwAAAIIAAACgzbADAAbNgBgMADAGwGwG'
    );
    const parenSlots = unpackPresetCode(parenthesized);
    assert.ok(parenSlots);
    assert.strictEqual(parenSlots.vanguard.characterId, 139);
    assert.strictEqual(parenSlots.versatile.characterId, 130);
    assert.strictEqual(parenSlots.support.characterId, 160);
  });

  it('returns null for invalid inputs, wrong lengths, unknown chars, or all-zero bytes', () => {
    assert.strictEqual(unpackPresetCode(''), null);
    assert.strictEqual(unpackPresetCode('invalid!@#$'), null);
    assert.strictEqual(unpackPresetCode('AAAA'), null);
    assert.strictEqual(unpackPresetCode('A'.repeat(36)), null); // all-zero bytes
    // Char ID 999999 in first 32 bits (0x000f423f)
    const badCharBytes = new Uint8Array(27);
    badCharBytes[1] = 0x0f;
    badCharBytes[2] = 0x42;
    badCharBytes[3] = 0x3f;
    const badCharB64 = btoa(String.fromCharCode(...badCharBytes));
    assert.strictEqual(unpackPresetCode(badCharB64), null);
  });

  it('packPresetCode returns null when any slot is missing a character', () => {
    const incompleteSlots: TeamBuild['slots'] = {
      vanguard: { characterId: 110, potentials: [] },
      versatile: { characterId: 145, potentials: [] },
      support: { characterId: null, potentials: [] },
    };
    assert.strictEqual(packPresetCode(incompleteSlots), null);
  });
});

describe('Advanced Visualizer preset code codec (SST1)', () => {
  const realDiscIds = Object.keys(discsData).slice(0, 6).map(Number);

  it('round-trips full Trekkers (Lv.1-9, priorities, off-role), Discs (level, crescendo, phase), and Musical Notes', () => {
    const baseSlots = unpackPresetCode('AAAAkAAAAKAAAAB9zbALDAAwBsNsAGwA2GwA')!;
    assert.ok(baseSlots);

    // Customize priorities, Lv.9 potential, and add an off-role potential on versatile
    const v110Pots = getCharacterPotentials(110);
    const v144OffRole = getCharacterPotentials(144).find((p) => p.slot === 'assist' && !p.isCore);
    assert.ok(v144OffRole);
    assert.ok(v110Pots.length > 0);

    const slots: TeamBuild['slots'] = {
      vanguard: {
        characterId: 144,
        potentials: [
          ...baseSlots.vanguard.potentials.map((p, idx) => ({
            ...p,
            level: p.rarity === 0 ? undefined : idx === 2 ? 9 : idx === 3 ? 1 : p.level,
            priority: idx === 1 ? ('Optional' as const) : idx === 2 ? ('Low' as const) : p.priority,
          })),
          {
            id: v144OffRole.id,
            rarity: v144OffRole.rarityNum,
            level: 8,
            priority: 'Core' as const,
          },
        ],
      },
      versatile: baseSlots.versatile,
      support: baseSlots.support,
    };

    const advancedBuild: AdvancedPresetData = {
      slots,
      mainDiscs: [
        { discId: realDiscIds[0], level: 90, crescendo: 6 },
        { discId: realDiscIds[1], level: 80, crescendo: 3 },
        { discId: realDiscIds[2], level: 1, crescendo: 1 },
      ],
      supportDiscs: [
        { discId: realDiscIds[3], level: 90, crescendo: 5, phase: 8 },
        { discId: realDiscIds[4], level: 80, crescendo: 2, phase: 4 },
        { discId: realDiscIds[5], level: 1, crescendo: 1, phase: 0 },
      ],
      targetNotes: {
        'Melody of Pummel': 0,
        'Melody of Luck': 14,
        'Melody of Skill': 42,
        'Melody of Aqua': 99,
      },
    };

    const packed = packAdvancedPresetCode(advancedBuild);
    assert.ok(packed, 'Expected SST1 code to pack');
    assert.ok(packed.startsWith('SST1'), `Expected SST1 prefix, got: ${packed.slice(0, 6)}`);

    const unpacked = unpackAdvancedPresetCode(packed);
    assert.ok(unpacked, 'Expected SST1 code to unpack');

    assert.deepStrictEqual(unpacked.mainDiscs, advancedBuild.mainDiscs);
    assert.deepStrictEqual(unpacked.supportDiscs, advancedBuild.supportDiscs);
    assert.deepStrictEqual(unpacked.targetNotes, advancedBuild.targetNotes);

    // Check slot details: off-role potential, Lv.9, and Low/Optional priority preserved
    const offRoleBack = unpacked.slots.vanguard.potentials.find((p) => p.id === v144OffRole.id);
    assert.ok(offRoleBack, 'Off-role potential should be preserved');
    assert.strictEqual(offRoleBack.level, 8);
    assert.strictEqual(offRoleBack.priority, 'Core');
    assert.ok(unpacked.slots.vanguard.potentials.some((p) => p.level === 9));
    assert.ok(unpacked.slots.vanguard.potentials.some((p) => p.priority === 'Optional'));

    // Re-packing yields byte-for-byte identical SST1 code
    assert.strictEqual(packAdvancedPresetCode(unpacked), packed);
  });

  it('supports partial slots/discs (empty Trekker slot, empty Disc slots, no targetNotes)', () => {
    const partialBuild: AdvancedPresetData = {
      slots: {
        vanguard: { characterId: 110, potentials: [] },
        versatile: { characterId: null, potentials: [] },
        support: { characterId: 142, potentials: [] },
      },
      mainDiscs: [
        { discId: realDiscIds[0], level: 80, crescendo: 4 },
        { discId: null, crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: realDiscIds[1], level: 90, crescendo: 6, phase: 5 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: {},
    };

    const packed = packAdvancedPresetCode(partialBuild);
    assert.ok(packed);
    assert.ok(packed.startsWith('SST1'));
    const unpacked = unpackAdvancedPresetCode(packed);
    assert.deepStrictEqual(unpacked, partialBuild);
  });

  it('normalizes URL ?adv= parameters, parentheses, and whitespace', () => {
    const build: AdvancedPresetData = {
      slots: {
        vanguard: { characterId: 110, potentials: [] },
        versatile: { characterId: null, potentials: [] },
        support: { characterId: null, potentials: [] },
      },
      mainDiscs: [
        { discId: realDiscIds[0], level: 90, crescendo: 2 },
        { discId: null, crescendo: 1, level: 90 },
        { discId: null, crescendo: 1, level: 90 },
      ],
      supportDiscs: [
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
        { discId: null, phase: 8, level: 80, crescendo: 1 },
      ],
      targetNotes: { 'Melody of Burst': 12 },
    };

    const code = packAdvancedPresetCode(build)!;
    assert.strictEqual(
      normalizeAdvancedPresetCodeInput(`https://localhost:3000/builder/advanced?adv=${encodeURIComponent(code)}`),
      code
    );
    assert.strictEqual(normalizeAdvancedPresetCodeInput(`  (${code})  `), code);
    assert.deepStrictEqual(unpackAdvancedPresetCode(`  (${code})  `), build);
  });

  it('rejects empty builds, plain in-game codes, truncated codes, and unknown character/disc IDs', () => {
    const emptyBuild: AdvancedPresetData = {
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
      targetNotes: {},
    };
    assert.strictEqual(packAdvancedPresetCode(emptyBuild), null);

    // Reject plain in-game preset code
    assert.strictEqual(unpackAdvancedPresetCode('AAAAiwAAAIIAAACgzbADAAbNgBgMADAGwGwG'), null);

    // Valid sample to corrupt
    const valid = packAdvancedPresetCode({
      ...emptyBuild,
      targetNotes: { 'Melody of Pummel': 5 },
    })!;
    assert.ok(valid);

    // Truncated code
    assert.strictEqual(unpackAdvancedPresetCode(valid.slice(0, 12)), null);

    // Non-existent disc ID in pack
    assert.strictEqual(
      packAdvancedPresetCode({
        ...emptyBuild,
        mainDiscs: [
          { discId: 999999, level: 90, crescendo: 1 },
          { discId: null, crescendo: 1, level: 90 },
          { discId: null, crescendo: 1, level: 90 },
        ],
      }),
      null
    );

    // Non-existent char ID in pack
    assert.strictEqual(
      packAdvancedPresetCode({
        ...emptyBuild,
        slots: {
          ...emptyBuild.slots,
          vanguard: { characterId: 999999, potentials: [] },
        },
      }),
      null
    );

    // Unknown charId patched directly into binary payload
    const rawBin = atob(valid);
    const corrupted = new Uint8Array(rawBin.length);
    for (let i = 0; i < rawBin.length; i++) corrupted[i] = rawBin.charCodeAt(i);
    // Bytes 3..6 are vanguard charId (currently 0) -> patch to 999999
    corrupted[5] = 0x0f;
    corrupted[6] = 0x42;
    const corruptedCode = btoa(String.fromCharCode(...corrupted));
    assert.strictEqual(unpackAdvancedPresetCode(corruptedCode), null);
  });
});
