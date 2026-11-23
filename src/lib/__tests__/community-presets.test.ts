import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../data/characters.json' with { type: 'json' };
import communityPresetsData from '../../data/community-presets.json' with { type: 'json' };
import blitzData from '../../data/datamined-blitz.json' with { type: 'json' };
import discsData from '../../data/discs.json' with { type: 'json' };
import { MUSICAL_NOTES } from '../../data/notes.ts';
import { packAdvancedPresetCode, unpackAdvancedPresetCode } from '../preset-code.ts';
import {
  CURRENT_PATCH,
  getCommunityPresetsForBlitz,
  getCommunityPresetsForDisc,
  getCommunityPresetsForTrekker,
  getResolvedCommunityPresetById,
  getResolvedCommunityPresets,
  isCommunityPresetStale,
  resolveCommunityPreset,
  type CommunityPresetEntry,
} from '../community-presets.ts';

const SAMPLE_IN_GAME_CODE = 'AAAAbgAAAJEAAACOzbAYAAbNgBsAAGwAwAwA'; // Trekkers [110, 145, 142]
const SAMPLE_IN_GAME_CODE_2 = 'AAAAkAAAAIIAAACgzbADDADNgBgMADAGw22A'; // Trekkers [144, 130, 160]

describe('community-presets data & resolver', () => {
  it('validates every entry in src/data/community-presets.json against characters, discs, and potentials', () => {
    const entries = communityPresetsData as CommunityPresetEntry[];
    const seenIds = new Set<string>();
    const hasCjk = /[\u4e00-\u9fff]/;

    for (const entry of entries) {
      assert.ok(entry.id && !seenIds.has(entry.id), `Duplicate or empty preset id: ${entry.id}`);
      seenIds.add(entry.id);
      assert.ok(entry.title && entry.title.length <= 80, `Invalid title on ${entry.id}`);
      assert.ok(!hasCjk.test(entry.title) && !hasCjk.test(entry.summary), `Non-English text in ${entry.id}`);
      assert.match(entry.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `Invalid date format on ${entry.id}`);
      assert.ok(entry.sources.length >= 1, `Expected >= 1 attribution source on ${entry.id}`);
      for (const src of entry.sources) {
        assert.match(src.url, /^https:\/\//, `Source URL must be https on ${entry.id}`);
      }

      const resolved = resolveCommunityPreset(entry);
      assert.ok(resolved, `Failed to unpack preset "${entry.id}" against current game data`);
      assert.ok(resolved.advCode.startsWith('SST1'), `Expected canonical SST1 code on ${entry.id}`);

      const validNotes = new Set(MUSICAL_NOTES.map((n) => n.name));
      const elementNoteNames = new Set([
        'Melody of Ignis',
        'Melody of Aqua',
        'Melody of Terra',
        'Melody of Ventus',
        'Melody of Umbra',
        'Melody of Lux',
      ]);
      const blitzByNumericId = new Map(
        Object.values(blitzData as Record<string, { id: number; weakTo: string[] }>).map((b) => [
          String(b.id),
          b,
        ])
      );

      for (const blitzId of entry.blitzIds || []) {
        const boss = blitzByNumericId.get(blitzId);
        assert.ok(boss, `Unknown blitzId "${blitzId}" in ${entry.id}`);
        assert.ok(
          boss.weakTo.includes(entry.element),
          `Preset ${entry.id} (${entry.element}) does not match blitzId ${blitzId} weakTo (${boss.weakTo.join(', ')})`
        );
      }

      for (const [noteName, count] of Object.entries(resolved.advData.targetNotes || {})) {
        assert.ok(validNotes.has(noteName as (typeof MUSICAL_NOTES)[number]['name']), `Invalid note "${noteName}" in ${entry.id}`);
        assert.ok(
          typeof count === 'number' && Number.isInteger(count) && count > 0 && count <= 99,
          `Invalid note count ${String(count)} for ${noteName} in ${entry.id}`
        );
        if (elementNoteNames.has(noteName)) {
          assert.strictEqual(
            noteName,
            `Melody of ${entry.element}`,
            `Unexpected off-element targetNote "${noteName}" in ${entry.element} preset ${entry.id}`
          );
        }
      }

      for (const sub of entry.substitutions || []) {
        if (sub.replacesType === 'trekker') {
          assert.ok(
            Object.prototype.hasOwnProperty.call(charactersData, String(sub.replacesId)),
            `Invalid replacesId trekker ${sub.replacesId} in ${entry.id}`
          );
          assert.ok(
            resolved.characterIds.includes(sub.replacesId),
            `Substitution replacesId trekker ${sub.replacesId} is not in squad for ${entry.id}`
          );
        } else {
          assert.ok(
            Object.prototype.hasOwnProperty.call(discsData, String(sub.replacesId)),
            `Invalid replacesId disc ${sub.replacesId} in ${entry.id}`
          );
          const slotDiscs =
            sub.replacesType === 'mainDisc' ? resolved.mainDiscIds : resolved.supportDiscIds;
          assert.ok(
            slotDiscs.includes(sub.replacesId),
            `Substitution replacesId ${sub.replacesType} ${sub.replacesId} is not equipped in ${entry.id}`
          );
        }
        for (const altId of sub.alternativeIds) {
          if (sub.replacesType === 'trekker') {
            assert.ok(
              Object.prototype.hasOwnProperty.call(charactersData, String(altId)),
              `Invalid substitute trekker ID ${altId} in ${entry.id}`
            );
          } else {
            assert.ok(
              Object.prototype.hasOwnProperty.call(discsData, String(altId)),
              `Invalid substitute disc ID ${altId} in ${entry.id}`
            );
          }
        }
      }
    }
  });

  it('resolves both 36-char inGameCode entries (with optional discs/notes) and SST1 advCode entries', () => {
    const discIds = Object.keys(discsData).map(Number);
    assert.ok(discIds.length >= 2);
    const mainDiscId = discIds[0];
    const supportDiscId = discIds[1];

    const fromInGame: CommunityPresetEntry = {
      id: 'in-game-sample',
      title: 'In-Game Code Squad',
      inGameCode: SAMPLE_IN_GAME_CODE,
      mainDiscs: [
        { discId: mainDiscId, level: 90, crescendo: 1 },
        { discId: null, level: 90, crescendo: 1 },
        { discId: null, level: 90, crescendo: 1 },
      ],
      supportDiscs: [
        { discId: supportDiscId, level: 80, crescendo: 1, phase: 8 },
        { discId: null, level: 80, crescendo: 1, phase: 8 },
        { discId: null, level: 80, crescendo: 1, phase: 8 },
      ],
      targetNotes: { 'Melody of Aqua': 25 },
      element: 'Aqua',
      archetype: 'Skill Cycle',
      modes: ['general'],
      tier: 'f2p',
      summary: 'Sample build imported from a 36-char in-game code.',
      sources: [{ label: 'Community Sheet', author: 'Test', url: 'https://example.com', kind: 'sheet' }],
      verifiedPatch: CURRENT_PATCH,
      verifiedAt: '2026-11-21',
    };

    const resolvedInGame = resolveCommunityPreset(fromInGame);
    assert.ok(resolvedInGame);
    assert.deepStrictEqual(resolvedInGame.characterIds, [110, 145, 142]);
    assert.strictEqual(resolvedInGame.inGameCode, SAMPLE_IN_GAME_CODE);
    assert.ok(resolvedInGame.advCode.startsWith('SST1'));
    assert.deepStrictEqual(resolvedInGame.mainDiscIds, [mainDiscId]);
    assert.deepStrictEqual(resolvedInGame.supportDiscIds, [supportDiscId]);

    const reparsed = unpackAdvancedPresetCode(resolvedInGame.advCode);
    assert.ok(reparsed);
    assert.strictEqual(reparsed.targetNotes['Melody of Aqua'], 25);

    // Now test advCode single-source-of-truth entry deriving characterIds & inGameCode
    const packedAdv = packAdvancedPresetCode(resolvedInGame.advData);
    assert.ok(packedAdv);
    const fromAdv: CommunityPresetEntry = {
      id: 'adv-sample',
      title: 'SST1 Squad',
      advCode: packedAdv,
      element: 'Ignis',
      archetype: 'Hypercarry',
      modes: ['boss-blitz'],
      tier: 'standard',
      blitzIds: ['2'],
      summary: 'Derived strictly from SST1.',
      sources: [{ label: 'Guide', author: 'TC', url: 'https://example.com', kind: 'guide' }],
      verifiedPatch: '1.7',
      verifiedAt: '2026-10-01',
    };

    const resolvedAdv = resolveCommunityPreset(fromAdv);
    assert.ok(resolvedAdv);
    assert.deepStrictEqual(resolvedAdv.characterIds, [110, 145, 142]);
    assert.strictEqual(resolvedAdv.inGameCode, SAMPLE_IN_GAME_CODE);
    assert.strictEqual(resolvedAdv.isStale, true);
  });

  it('filters by Trekker, Disc (including substitutions), Blitz ID / element fallback, and excludes archived', () => {
    const discIds = Object.keys(discsData).map(Number);
    const d1 = discIds[0];
    const d2 = discIds[1];
    const d3 = discIds[2];

    const fixtures: CommunityPresetEntry[] = [
      {
        id: 'blitz-explicit',
        title: 'Blitz Explicit Match',
        inGameCode: SAMPLE_IN_GAME_CODE,
        mainDiscs: [{ discId: d1, level: 90, crescendo: 1 }],
        element: 'Ventus',
        archetype: 'Skill',
        modes: ['boss-blitz'],
        tier: 'standard',
        blitzIds: ['blitz-99'],
        summary: 'Explicit blitz match.',
        substitutions: [{ replacesType: 'mainDisc', replacesId: d1, alternativeIds: [d2], note: 'F2P swap' }],
        sources: [{ label: 'Ref', author: 'TC', url: 'https://example.com', kind: 'sheet' }],
        verifiedPatch: CURRENT_PATCH,
        verifiedAt: '2026-11-20',
      },
      {
        id: 'element-fallback',
        title: 'Ignis Fallback',
        inGameCode: SAMPLE_IN_GAME_CODE_2,
        mainDiscs: [{ discId: d3, level: 90, crescendo: 1 }],
        element: 'Ignis',
        archetype: 'Auto',
        modes: ['general'],
        tier: 'f2p',
        summary: 'Ignis fallback team.',
        sources: [{ label: 'Ref', author: 'TC', url: 'https://example.com', kind: 'guide' }],
        verifiedPatch: CURRENT_PATCH,
        verifiedAt: '2026-11-21',
      },
      {
        id: 'archived-old',
        title: 'Archived Team',
        inGameCode: SAMPLE_IN_GAME_CODE,
        element: 'Ignis',
        archetype: 'Old',
        modes: ['general'],
        tier: 'f2p',
        summary: 'Should be hidden by default.',
        sources: [{ label: 'Ref', author: 'TC', url: 'https://example.com', kind: 'guide' }],
        verifiedPatch: '1.0',
        verifiedAt: '2025-11-01',
        status: 'archived',
      },
    ];

    const active = getResolvedCommunityPresets(fixtures);
    assert.strictEqual(active.length, 2);
    assert.strictEqual(getResolvedCommunityPresetById('archived-old', fixtures)?.status, 'archived');

    assert.deepStrictEqual(
      getCommunityPresetsForTrekker(145, fixtures).map((p) => p.id),
      ['blitz-explicit']
    );
    assert.deepStrictEqual(
      getCommunityPresetsForDisc(d2, fixtures).map((p) => p.id),
      ['blitz-explicit']
    );

    const explicitMatch = getCommunityPresetsForBlitz('blitz-99', ['Ignis'], fixtures);
    assert.strictEqual(explicitMatch.matchKind, 'explicit');
    assert.deepStrictEqual(explicitMatch.presets.map((p) => p.id), ['blitz-explicit']);

    const fallbackMatch = getCommunityPresetsForBlitz('other-boss', ['Ignis', 'Aqua'], fixtures);
    assert.strictEqual(fallbackMatch.matchKind, 'element');
    assert.deepStrictEqual(fallbackMatch.presets.map((p) => p.id), ['element-fallback']);

    assert.strictEqual(isCommunityPresetStale('1.9', 'verified', '2.0'), false);
    assert.strictEqual(isCommunityPresetStale('1.8', 'verified', '2.0'), true);
    assert.strictEqual(isCommunityPresetStale('2.0', 'outdated', '2.0'), true);
  });
});
