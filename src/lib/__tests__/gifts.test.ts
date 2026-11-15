import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GIFT_FAMILIES,
  STELLA_SORA_GIFTS,
  getCharacterFavoriteFamilies,
  isGiftHatedBy,
  isGiftLovedBy,
  type GiftFamily,
} from '../../data/gifts.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
const CHARACTERS_PATH = path.join(ROOT_DIR, 'src/data/characters.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

interface RawCharacter {
  id: number;
  name: { EN: string };
}

describe('STELLA_SORA_GIFTS and GIFT_FAMILIES integrity', () => {
  it('defines all 8 families with 3 rarities (3★, 4★, 5★) totaling 24 unique gifts', () => {
    const families = Object.keys(GIFT_FAMILIES) as GiftFamily[];
    assert.equal(families.length, 8);
    assert.equal(STELLA_SORA_GIFTS.length, 24);

    const ids = new Set(STELLA_SORA_GIFTS.map((g) => g.id));
    assert.equal(ids.size, 24);

    for (const family of families) {
      const members = STELLA_SORA_GIFTS.filter((g) => g.family === family);
      const rarities = members.map((g) => g.rarity).sort((a, b) => a - b);
      assert.deepEqual(
        rarities,
        [3, 4, 5],
        `Expected rarities [3, 4, 5] for family ${family}, got ${JSON.stringify(rarities)}`
      );
    }
  });

  it('references existing icon assets under public/ for every gift', () => {
    for (const gift of STELLA_SORA_GIFTS) {
      const rel = gift.imageUrl.replace(/^\/+/, '');
      const fullPath = path.join(PUBLIC_DIR, rel);
      assert.ok(fs.existsSync(fullPath), `Missing icon file for ${gift.name}: ${fullPath}`);
    }
  });

  it('has zero overlap between loved and hated characters per family/gift', () => {
    for (const [family, info] of Object.entries(GIFT_FAMILIES)) {
      const hatedSet = new Set(info.hatedCharIds);
      for (const charId of info.lovedCharIds) {
        assert.equal(
          hatedSet.has(charId),
          false,
          `Character ${charId} appears in both loved and hated for ${family}`
        );
      }
    }

    for (const gift of STELLA_SORA_GIFTS) {
      for (const charId of gift.lovedByCharacterIds) {
        assert.equal(
          isGiftHatedBy(gift, charId),
          false,
          `Character ${charId} overlaps on gift ${gift.id}`
        );
      }
    }
  });

  it('gives every playable Trekker at least 2 complete loved gift families in sync with STELLA_SORA_GIFTS', () => {
    const rawMap = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8')) as Record<string, RawCharacter>;
    const characters = Object.values(rawMap);
    assert.ok(characters.length >= 42);

    for (const char of characters) {
      const favFamilies = getCharacterFavoriteFamilies(char.id);
      const lovedGifts = STELLA_SORA_GIFTS.filter((gift) => isGiftLovedBy(gift, char.id));

      assert.ok(
        favFamilies.length >= 2,
        `Trekker ${char.name.EN} (${char.id}) has fewer than 2 favorite families: ${favFamilies.length}`
      );
      assert.equal(
        lovedGifts.length,
        favFamilies.length * 3,
        `Trekker ${char.name.EN} (${char.id}) has ${lovedGifts.length} loved gifts but ${favFamilies.length} favorite families`
      );
      for (const fam of favFamilies) {
        assert.equal(
          lovedGifts.filter((g) => g.family === fam).length,
          3,
          `Trekker ${char.name.EN} (${char.id}) does not have all 3 rarities in loved family ${fam}`
        );
      }
    }
  });
});
