import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAllDiscs,
  getAllDiscTags,
  getDiscBySlugOrId,
  getDiscRequiredHarmonyNotes,
  getDiscSlug,
  getDiscStatSummary,
  getDiscSupportNotesAtPhase,
  getExclusiveBannerByDiscId,
  getExclusiveDiscForTrekker,
} from '../discs.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
const CHARACTERS_PATH = path.join(ROOT_DIR, 'src/data/characters.json');

interface RawChar {
  id: number;
  name: { EN: string };
  star: number;
}

describe('Runic Disc catalog and exclusive banner helpers', () => {
  it('loads all 106 discs with unique non-empty slugs', () => {
    const all = getAllDiscs();
    assert.equal(all.length, 106);

    const slugs = new Set<string>();
    for (const disc of all) {
      const slug = getDiscSlug(disc.name);
      assert.ok(slug.length > 0, `Empty slug for disc ${disc.id}`);
      assert.equal(slugs.has(slug), false, `Duplicate slug ${slug}`);
      slugs.add(slug);

      assert.equal(getDiscBySlugOrId(slug)?.id, disc.id);
      assert.equal(getDiscBySlugOrId(String(disc.id))?.id, disc.id);
    }

    assert.equal(getDiscBySlugOrId('bam-bam-girl')?.id, 213005);
    assert.equal(getDiscBySlugOrId('dream-factory-of-truth')?.id, 214032);
    assert.equal(getDiscBySlugOrId('sky-flowers-poem')?.id, 214002);
    assert.ok(getAllDiscTags().length > 0);
  });

  it('pairs every 5★ Trekker 1-to-1 with a dedicated banner 5★ disc and omits 4★ Trekkers', () => {
    const rawChars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8')) as Record<string, RawChar>;
    const chars = Object.values(rawChars);

    const fiveStars = chars.filter((c) => c.star === 5);
    const fourStars = chars.filter((c) => c.star !== 5);
    assert.equal(fiveStars.length, 26);

    for (const char of fiveStars) {
      const byId = getExclusiveDiscForTrekker(char.id);
      const byName = getExclusiveDiscForTrekker(char.name.EN);
      assert.ok(byId, `Missing dedicated banner disc for 5★ ${char.name.EN} (${char.id})`);
      assert.equal(byId.disc.star, 5);
      assert.equal(byName?.discId, byId.discId);
    }

    for (const char of fourStars) {
      assert.equal(
        getExclusiveDiscForTrekker(char.id),
        undefined,
        `4★ ${char.name.EN} should not have a dedicated 5★ disc banner`
      );
    }

    assert.equal(getExclusiveDiscForTrekker('Chitose')?.discId, 214026);
    assert.equal(getExclusiveBannerByDiscId(214026)?.trekkerName, 'Chitose');
    assert.equal(getExclusiveBannerByDiscId(214031), undefined);
  });

  it('computes C1-C6 stats, harmony notes, and phase-clamped support notes', () => {
    const catGod = getDiscBySlugOrId('meowing-cat-god');
    assert.ok(catGod);

    const c1 = getDiscStatSummary(catGod, 'lv90', 1);
    assert.equal(c1.baseAtk, 932);
    assert.equal(c1.bonusAtk, 0);
    assert.equal(c1.totalAtk, 932);
    assert.equal(c1.secondaryLabel, 'Ignis DMG');
    assert.equal(c1.secondaryValue, '15%');

    const c2 = getDiscStatSummary(catGod, 'lv90', 2);
    assert.equal(c2.bonusAtk, 130);
    assert.equal(c2.totalAtk, 932 + 130);

    const c6 = getDiscStatSummary(catGod, 'lv90', 6);
    assert.equal(c6.bonusAtk, 650);
    assert.equal(c6.totalAtk, 932 + 650);

    assert.deepEqual(getDiscStatSummary(catGod, 'lv90', 0), c1);
    assert.deepEqual(getDiscStatSummary(catGod, 'lv90', 9), c6);

    const harmonyNotes = getDiscRequiredHarmonyNotes(catGod);
    assert.ok(harmonyNotes.includes('Melody of Burst'));
    assert.ok(harmonyNotes.includes('Melody of Ignis'));

    assert.deepEqual(getDiscSupportNotesAtPhase(catGod, 0), catGod.supportNote[0]);
    assert.deepEqual(
      getDiscSupportNotesAtPhase(catGod, 99),
      catGod.supportNote[catGod.supportNote.length - 1]
    );
  });
});
