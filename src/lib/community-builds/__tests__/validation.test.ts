import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import charactersData from '../../../data/characters.json' with { type: 'json' };
import discsData from '../../../data/discs.json' with { type: 'json' };
import referencePresetsData from '../../calculator/__tests__/fixtures/reference-presets.json' with { type: 'json' };
import { resolveCommunityPreset, type CommunityPresetEntry } from '../../community-presets.ts';
import { getSql, isDatabaseConfigured } from '../../db/neon.ts';
import { packAdvancedPresetCode } from '../../preset-code.ts';
import type { AdvancedTeamBuild, SSCharacter, SSDisc } from '../../../types/index.ts';
import {
  createAdminCookieValue,
  verifyAdminCookieValue,
  verifyAdminSecret,
} from '../security.ts';
import {
  generateBuildSlug,
  isBotUserAgent,
  validatePublishInput,
} from '../validation.ts';

const ALL_CHARACTERS = charactersData as unknown as Record<string, SSCharacter>;
const ALL_DISCS = discsData as unknown as Record<string, SSDisc>;
const REFERENCE_PRESETS = referencePresetsData as unknown as CommunityPresetEntry[];

const SAMPLE_ADV_CODE = resolveCommunityPreset(REFERENCE_PRESETS[0], ALL_CHARACTERS, ALL_DISCS)?.advCode || '';

function makeEmptySquadAdvCode(): string {
  const emptyBuild: AdvancedTeamBuild = {
    id: 'empty',
    name: 'Empty',
    createdAt: 0,
    slots: {
      vanguard: { characterId: null, potentials: [] },
      versatile: { characterId: null, potentials: [] },
      support: { characterId: null, potentials: [] },
    },
    mainDiscs: [
      { discId: 214013, crescendo: 1, level: 90 },
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
  return packAdvancedPresetCode(emptyBuild, ALL_CHARACTERS, ALL_DISCS) || '';
}

describe('community-builds validation & security', () => {
  it('accepts a valid SST1 payload, defaults author to Anonymous, sanitizes control chars, and derives element + inGameCode', () => {
    assert.ok(SAMPLE_ADV_CODE.startsWith('SST1'), 'Expected valid sample SST1 code');

    const res = validatePublishInput(
      {
        title: '  Eleanor\u0007 Skill   Willow  ',
        authorName: '   ',
        tier: 'f2p',
        modes: ['boss-blitz', 'general', 'boss-blitz'],
        archetype: '',
        summary: 'Smooth skill rotation\u0000 with steady uptime.',
        rotation: ['Open with support skill', '  ', 'Trigger Vanguard burst'],
        advCode: SAMPLE_ADV_CODE,
        website: '',
      },
      ALL_CHARACTERS,
      ALL_DISCS
    );

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.data.title, 'Eleanor Skill Willow');
    assert.equal(res.data.authorName, 'Anonymous');
    assert.equal(res.data.tier, 'f2p');
    assert.deepEqual(res.data.modes, ['boss-blitz', 'general']);
    assert.equal(res.data.archetype, 'Community Build');
    assert.equal(res.data.summary, 'Smooth skill rotation with steady uptime.');
    assert.deepEqual(res.data.rotation, [
      'Open with support skill',
      'Trigger Vanguard burst',
    ]);
    assert.ok(res.data.advCode.startsWith('SST1'));
    assert.ok(res.data.inGameCode && res.data.inGameCode.length === 36);
    assert.ok(res.data.characterIds.length >= 1);
    assert.ok(
      ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Umbra', 'Lux'].includes(res.data.element)
    );
  });

  it('rejects honeypot submissions, empty squads, invalid codes, and out-of-bounds fields', () => {
    const honeypot = validatePublishInput({
      title: 'Valid Build Title',
      advCode: SAMPLE_ADV_CODE,
      website: 'https://spam.example',
    });
    assert.equal(honeypot.ok, false);

    const shortTitle = validatePublishInput({
      title: 'Abc',
      advCode: SAMPLE_ADV_CODE,
    });
    assert.equal(shortTitle.ok, false);

    const badCode = validatePublishInput({
      title: 'Valid Build Title',
      advCode: 'SST1-NOT-VALID',
    });
    assert.equal(badCode.ok, false);

    const emptySquadCode = makeEmptySquadAdvCode();
    if (emptySquadCode) {
      const noTrekkers = validatePublishInput({
        title: 'Disc Only Squad',
        advCode: emptySquadCode,
      });
      assert.equal(noTrekkers.ok, false);
    }

    const tooManyLines = validatePublishInput({
      title: 'Valid Build Title',
      advCode: SAMPLE_ADV_CODE,
      rotation: Array.from({ length: 9 }, (_, i) => `Step ${i + 1}`),
    });
    assert.equal(tooManyLines.ok, false);
    if (!tooManyLines.ok) {
      assert.match(tooManyLines.error, /author notes/i);
    }

    const removedMode = validatePublishInput({
      title: 'Valid Build Title',
      advCode: SAMPLE_ADV_CODE,
      modes: ['monolith'],
    });
    assert.equal(removedMode.ok, false);
  });

  it('generates URL-safe unique slugs and avoids reserved curated IDs', () => {
    const slug = generateBuildSlug('Éleanor / Skill & Willow!! 2.1');
    assert.match(slug, /^eleanor-skill-willow-2-1-[0-9a-f]{4}$/);

    const fallbackSlug = generateBuildSlug('!!!');
    assert.match(fallbackSlug, /^squad-build-[0-9a-f]{4}$/);

    const reserved = new Set<string>();
    const generated = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = generateBuildSlug('Test Squad', reserved);
      assert.ok(!reserved.has(s));
      generated.add(s);
    }
    assert.ok(generated.size >= 18);
  });

  it('detects crawlers and headless monitors while passing real browsers', () => {
    assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
    assert.equal(isBotUserAgent('curl/8.7.1'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 HeadlessChrome/125.0.0.0 Safari/537.36'), true);
    assert.equal(isBotUserAgent('Playwright/1.65.0'), true);
    assert.equal(isBotUserAgent('Chrome-Lighthouse'), true);
    assert.equal(isBotUserAgent('Pingdom.com_bot_version_1.4'), true);

    assert.equal(
      isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'),
      false
    );
    assert.equal(
      isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'),
      false
    );
    assert.equal(
      isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'),
      false
    );
    assert.equal(isBotUserAgent(''), false);
    assert.equal(isBotUserAgent(null), false);
  });

  it('signs and verifies admin HMAC cookies and constant-time password checks', () => {
    const secret = 'super-secret-admin-key-32-chars!!';
    const now = 1_760_000_000_000;
    const cookie = createAdminCookieValue(secret, now);

    assert.equal(verifyAdminCookieValue(cookie, secret, now + 1000), true);
    assert.equal(verifyAdminCookieValue(cookie, 'wrong-secret', now + 1000), false);

    // Tampered signature
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('a') ? 'b' : 'a'}`;
    assert.equal(verifyAdminCookieValue(tampered, secret, now + 1000), false);

    // Expired (> 7 days)
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    assert.equal(verifyAdminCookieValue(cookie, secret, now + eightDaysMs), false);

    // Password check
    assert.equal(verifyAdminSecret(secret, secret), true);
    assert.equal(verifyAdminSecret('wrong', secret), false);
    assert.equal(verifyAdminSecret('', secret), false);
  });

  it('returns null cleanly from getSql() when DATABASE_URL is unset', () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      assert.equal(isDatabaseConfigured(), false);
      assert.equal(getSql(), null);
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
    }
  });
});
