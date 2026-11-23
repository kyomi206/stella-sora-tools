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
import {
  buildDefaultRotationEntriesForSlot,
  deriveProfileFromRotation,
  hasActiveRotationEntries,
  sanitizeBuildRotation,
  toSlotRotationAbilities,
  type BuildRotation,
  type ParsedRotationSkillOption,
} from '../build-rotation.ts';
import { buildDiscRankingContext } from '../disc-rankings.ts';
import {
  computeEstimatedDiscRankings,
  DEFAULT_DISC_RANKING_ASSUMPTIONS,
  type DiscRankingRosterEntry,
} from '../disc-rankings-client.ts';
import type { CharacterCombatEntry } from '../fighter-calc.ts';
import {
  computeEstimatedEmblemRankings,
  computeEstimatedPotentialRankings,
  computeEstimatedTalentRankings,
} from '../potential-emblem-rankings.ts';

function makeRosterEntry(
  slot: 'vanguard' | 'versatile' | 'support',
  id: number,
  name: string,
  scalingStat: 'ATK' | 'HP' = 'ATK',
): DiscRankingRosterEntry {
  return {
    slot,
    character: {
      id,
      name: { EN: name },
      star: 5,
      element: 'Ignis',
      class: slot === 'vanguard' ? 'Vanguard' : slot === 'versatile' ? 'Versatile' : 'Support',
      attackType: 'Melee',
      icon: '',
    } as unknown as DiscRankingRosterEntry['character'],
    combat: {
      id,
      name,
      star: 5,
      element: 'Ignis',
      class: slot === 'vanguard' ? 'Vanguard' : slot === 'versatile' ? 'Versatile' : 'Support',
      scalingStat,
      stats: { '90': { atk: 1000, hp: 10000, vul: 0 } },
    },
  };
}

describe('build-rotation schema & helpers', () => {
  it('sanitizeBuildRotation accepts valid v1 rotations, clamps values, drops invalid entries, and rejects empty/malformed inputs', () => {
    assert.equal(sanitizeBuildRotation(null), undefined);
    assert.equal(sanitizeBuildRotation('bad'), undefined);
    assert.equal(sanitizeBuildRotation({ version: 2, slots: {} }), undefined);
    assert.equal(
      sanitizeBuildRotation({
        version: 1,
        slots: {
          vanguard: [
            {
              id: 'zero-casts',
              source: 'skill',
              name: 'Skill',
              damageType: 'Skill',
              scalingStat: 'ATK',
              motionValuePct: 500,
              hits: 1,
              casts: 0,
            },
          ],
        },
      }),
      undefined,
    );

    const sanitized = sanitizeBuildRotation({
      version: 1,
      label: '  Custom 20s  ',
      durationSec: 25,
      slots: {
        vanguard: [
          {
            id: 'skill-1',
            source: 'skill',
            name: 'Main Skill',
            damageType: 'Skill',
            scalingStat: 'ATK',
            motionValuePct: 200000, // clamp to 100000
            hits: 150, // clamp to 99
            casts: 1200, // clamp to 999
          },
          {
            id: 'bad-entry',
            source: 'invalid-source',
            name: 'Bad',
            damageType: 'Skill',
            scalingStat: 'ATK',
            motionValuePct: 100,
            hits: 1,
            casts: 1,
          },
        ],
        unknownSlot: [
          {
            id: 'ignored',
            source: 'skill',
            name: 'Ignored',
            damageType: 'Skill',
            scalingStat: 'ATK',
            motionValuePct: 100,
            hits: 1,
            casts: 1,
          },
        ],
      },
    });

    assert.ok(sanitized);
    assert.equal(sanitized.version, 1);
    assert.equal(sanitized.label, 'Custom 20s');
    assert.equal(sanitized.durationSec, 25);
    assert.equal(sanitized.slots.vanguard?.length, 1);
    assert.equal(sanitized.slots.vanguard?.[0].motionValuePct, 100000);
    assert.equal(sanitized.slots.vanguard?.[0].hits, 99);
    assert.equal(sanitized.slots.vanguard?.[0].casts, 999);
    assert.equal(hasActiveRotationEntries(sanitized), true);
  });

  it('deriveProfileFromRotation selects highest normalized-MV slot (including versatile carry & HP normalization)', () => {
    const roster = [
      makeRosterEntry('vanguard', 1, 'Suntide Willow', 'ATK'),
      makeRosterEntry('versatile', 2, 'Eleanor', 'HP'),
      makeRosterEntry('support', 3, 'Nazuka', 'ATK'),
    ];

    const rotation: BuildRotation = {
      version: 1,
      slots: {
        vanguard: [
          {
            id: 'v-skill',
            source: 'skill',
            name: 'Willow Skill',
            damageType: 'Skill',
            scalingStat: 'ATK',
            motionValuePct: 300,
            hits: 1,
            casts: 2, // normalized = 600
          },
        ],
        versatile: [
          {
            id: 'ver-skill',
            source: 'supportSkill',
            name: 'Eleanor Skill',
            damageType: 'Skill',
            scalingStat: 'HP',
            motionValuePct: 160, // normalized = 160 / 0.16 = 1000 per cast
            hits: 1,
            casts: 4, // total normalized = 4000
          },
          {
            id: 'ver-ult',
            source: 'ultimate',
            name: 'Eleanor Ult',
            damageType: 'Ultimate',
            scalingStat: 'HP',
            motionValuePct: 80, // normalized = 500
            hits: 1,
            casts: 1,
          },
        ],
        support: [],
      },
    };

    const profile = deriveProfileFromRotation(rotation, roster);
    assert.equal(profile.carrySlot, 'versatile');
    assert.equal(profile.carryTypeStat, 'skillDmg');
    const verSlices = profile.slots.versatile ?? [];
    assert.equal(verSlices.length, 2);
    assert.equal(verSlices[0].type, 'Skill');
    assert.ok(verSlices[0].weight > verSlices[1].weight);
    // HP-scaler normalization: 4000 vs vanguard 600 -> versatile has ~6.67x vanguard weight
    const vanSlices = profile.slots.vanguard ?? [];
    assert.ok(verSlices[0].weight > (vanSlices[0]?.weight ?? 0) * 5);

    const abilities = toSlotRotationAbilities(rotation, 'versatile');
    assert.equal(abilities.length, 2);
    assert.equal(abilities[0].casts, 4);
  });

  it('deriveProfileFromRotation handles all-zero rotation without NaN', () => {
    const roster = [makeRosterEntry('vanguard', 1, 'Tester', 'ATK')];
    const zeroRot: BuildRotation = {
      version: 1,
      slots: {
        vanguard: [
          {
            id: 'zero',
            source: 'normalAtk',
            name: 'AA',
            damageType: 'Auto Attack',
            scalingStat: 'ATK',
            motionValuePct: 100,
            hits: 1,
            casts: 0,
          },
        ],
      },
    };
    const profile = deriveProfileFromRotation(zeroRot, roster);
    assert.equal(profile.carrySlot, 'vanguard');
    assert.equal(profile.carryTypeStat, 'aaDmg');
    assert.ok(Number.isFinite(profile.slots.vanguard?.[0]?.weight ?? 0));
  });

  it('buildDefaultRotationEntriesForSlot assigns expected starter cast counts', () => {
    const options: ParsedRotationSkillOption[] = [
      {
        id: 'aa',
        source: 'normalAtk',
        name: 'Basic Attack',
        partLabel: 'Combo',
        damageType: 'Auto Attack',
        scalingStat: 'ATK',
        motionValuePct: 150,
        hits: 3,
        cooldownSec: null,
      },
      {
        id: 'sk',
        source: 'skill',
        name: 'Main Skill',
        partLabel: 'Cast',
        damageType: 'Skill',
        scalingStat: 'ATK',
        motionValuePct: 400,
        hits: 1,
        cooldownSec: 8,
      },
      {
        id: 'mk',
        source: 'supportSkill',
        name: 'Support Skill',
        partLabel: 'Mark Trigger',
        damageType: 'Mark',
        scalingStat: 'ATK',
        motionValuePct: 250,
        hits: 1,
        cooldownSec: 10,
      },
      {
        id: 'ul',
        source: 'ultimate',
        name: 'Ultimate',
        partLabel: 'Burst',
        damageType: 'Ultimate',
        scalingStat: 'ATK',
        motionValuePct: 900,
        hits: 1,
        cooldownSec: 25,
      },
    ];

    const entries = buildDefaultRotationEntriesForSlot('vanguard', options);
    assert.equal(entries.length, 4);
    assert.equal(entries.find((e) => e.id === 'aa')?.casts, 4);
    assert.equal(entries.find((e) => e.id === 'sk')?.casts, 2);
    assert.equal(entries.find((e) => e.id === 'mk')?.casts, 2);
    assert.equal(entries.find((e) => e.id === 'ul')?.casts, 1);

    const defClean = sanitizeBuildRotation({
      version: 1,
      slots: {
        vanguard: [
          {
            id: 'def-hit',
            source: 'custom',
            name: 'DEF Slam',
            damageType: 'Skill',
            scalingStat: 'DEF',
            motionValuePct: 120,
            hits: 1,
            casts: 2,
          },
        ],
      },
    });
    assert.ok(defClean);
    assert.equal(defClean.slots.vanguard?.[0].scalingStat, 'DEF');
  });

  it('maintains 100% scale invariance across Disc, Potential, Emblem, and Talent % rankings when rotation casts scale 3x', () => {
    const characters = charactersData as unknown as Record<string, SSCharacter>;
    const combatDb = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
    const discs = discsData as unknown as Record<string, SSDisc>;
    const potentialsDb = potentialsDbData as unknown as Record<string, SSPotentialFull[]>;
    const rawEntry = (communityPresetsData as unknown as CommunityPresetEntry[]).find(
      (e) => e.id === 'eleanor-skill-willow'
    )!;
    const basePreset = resolveCommunityPreset(rawEntry) as ResolvedCommunityPreset;

    const rot1x: BuildRotation = {
      version: 1,
      slots: {
        vanguard: [
          {
            id: 'willow-sk',
            source: 'skill',
            name: 'Willow Skill',
            damageType: 'Skill',
            scalingStat: 'ATK',
            motionValuePct: 240,
            hits: 1,
            casts: 1,
          },
        ],
        versatile: [
          {
            id: 'eleanor-sk',
            source: 'supportSkill',
            name: 'Eleanor Skill',
            damageType: 'Skill',
            scalingStat: 'HP',
            motionValuePct: 180,
            hits: 1,
            casts: 3,
          },
          {
            id: 'eleanor-ult',
            source: 'ultimate',
            name: 'Eleanor Ult',
            damageType: 'Ultimate',
            scalingStat: 'HP',
            motionValuePct: 260,
            hits: 1,
            casts: 1,
          },
        ],
      },
    };

    const rot3x: BuildRotation = {
      version: 1,
      slots: {
        vanguard: rot1x.slots.vanguard!.map((e) => ({ ...e, casts: e.casts * 3 })),
        versatile: rot1x.slots.versatile!.map((e) => ({ ...e, casts: e.casts * 3 })),
      },
    };

    const ctx1x = buildDiscRankingContext(
      { ...basePreset, combatRotation: rot1x },
      characters,
      combatDb,
      discs,
      potentialsDb
    );
    const ctx3x = buildDiscRankingContext(
      { ...basePreset, combatRotation: rot3x },
      characters,
      combatDb,
      discs,
      potentialsDb
    );

    const disc1 = computeEstimatedDiscRankings(ctx1x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const disc3 = computeEstimatedDiscRankings(ctx3x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    assert.deepEqual(disc1.main.slice(0, 5), disc3.main.slice(0, 5));
    assert.deepEqual(disc1.support.slice(0, 5), disc3.support.slice(0, 5));

    const pot1 = computeEstimatedPotentialRankings(ctx1x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const pot3 = computeEstimatedPotentialRankings(ctx3x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    assert.deepEqual(pot1.potRank.slice(0, 8), pot3.potRank.slice(0, 8));
    assert.deepEqual(pot1.potPlus3.slice(0, 8), pot3.potPlus3.slice(0, 8));

    const emb1 = computeEstimatedEmblemRankings(ctx1x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const emb3 = computeEstimatedEmblemRankings(ctx3x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    assert.deepEqual(emb1, emb3);

    const tal1 = computeEstimatedTalentRankings(ctx1x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    const tal3 = computeEstimatedTalentRankings(ctx3x, DEFAULT_DISC_RANKING_ASSUMPTIONS);
    assert.deepEqual(
      tal1.map((t) => t.tiers.map((r) => [r.personalInc, r.teamInc])),
      tal3.map((t) => t.tiers.map((r) => [r.personalInc, r.teamInc]))
    );
  });
});
