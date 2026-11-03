import assert from 'node:assert/strict';
import {
  STELLA_SORA_GIFTS,
  GIFT_FAMILIES,
  isGiftLovedBy,
  isGiftHatedBy,
  getGiftAffinityMood,
  getGiftEffectiveExp,
  getCharacterFavoriteFamilies,
} from '../src/data/gifts.ts';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('--- Testing Gifts Data & Integration ---');

// 1. Verify 21 gifts are present across 3 tiers and 7 families
assert.equal(STELLA_SORA_GIFTS.length, 21, 'Should have exactly 21 canonical gifts');

const fiveStarGifts = STELLA_SORA_GIFTS.filter((g) => g.rarity === 5);
const fourStarGifts = STELLA_SORA_GIFTS.filter((g) => g.rarity === 4);
const threeStarGifts = STELLA_SORA_GIFTS.filter((g) => g.rarity === 3);

assert.equal(fiveStarGifts.length, 7, 'Should have 7 5★ gifts');
assert.equal(fourStarGifts.length, 7, 'Should have 7 4★ gifts');
assert.equal(threeStarGifts.length, 7, 'Should have 7 3★ gifts');

// 2. Verify Base EXP values
for (const g of fiveStarGifts) assert.equal(g.baseExp, 2000, `${g.name} should have 2000 base EXP`);
for (const g of fourStarGifts) assert.equal(g.baseExp, 500, `${g.name} should have 500 base EXP`);
for (const g of threeStarGifts) assert.equal(g.baseExp, 150, `${g.name} should have 150 base EXP`);

// 3. Verify key authentic gift names and images
const giftNames = STELLA_SORA_GIFTS.map((g) => g.name);
assert(giftNames.includes('Sweet Ice Furry'), 'Sweet Ice Furry should exist');
assert(giftNames.includes('Mystic Potion Kettle'), 'Mystic Potion Kettle should exist');
assert(giftNames.includes('Blossom Porcelain Cup'), 'Blossom Porcelain Cup should exist');
assert(giftNames.includes('Moonlit Companion'), 'Moonlit Companion should exist');
assert(giftNames.includes('Blazing Wings'), 'Blazing Wings should exist');
assert(giftNames.includes('Love Candle'), 'Love Candle should exist');
assert(giftNames.includes('Star Eclipse'), 'Star Eclipse should exist');
assert(giftNames.includes('Card Capturer'), 'Card Capturer should exist');

// 4. Verify gift images exist on disk and have valid URLs
for (const gift of STELLA_SORA_GIFTS) {
  assert(gift.itemId, `${gift.name} should have an itemId`);
  assert(gift.imageUrl, `${gift.name} should have an imageUrl`);
  assert(gift.imageUrl.startsWith('/gifts/item_'), `${gift.name} imageUrl should be in /gifts/item_ format`);
  assert(gift.fallbackUrl.includes('ssassets'), `${gift.name} fallbackUrl should reference ssassets CDN`);

  // Check file on disk (works from both root and blank/)
  const localRelative = gift.imageUrl.replace(/^\//, '');
  const pathInBlank = resolve('blank/public', localRelative);
  const pathDirect = resolve('public', localRelative);
  const exists = existsSync(pathInBlank) || existsSync(pathDirect);
  assert(exists, `Gift picture file should exist for ${gift.name} (${gift.imageUrl})`);
}

// 5. Verify Character Preferences & Face Moods
// Chitose (144): loves Flame, Ceramic, Wind; hates Star
const chitoseFamilies = getCharacterFavoriteFamilies(144);
assert(chitoseFamilies.includes('Flame'), 'Chitose should love Flame');
assert(chitoseFamilies.includes('Ceramic'), 'Chitose should love Ceramic');
assert(chitoseFamilies.includes('Wind'), 'Chitose should love Wind');

const porcelainCup = STELLA_SORA_GIFTS.find((g) => g.id === 'porcelain-cup');
assert(porcelainCup, 'Porcelain cup should exist');
assert.equal(isGiftLovedBy(porcelainCup, 144), true, 'Chitose should love Blossom Porcelain Cup');
assert.equal(getGiftAffinityMood(porcelainCup, 144), 'loved', 'Porcelain cup should have loved (yellow face) for Chitose');
assert.equal(getGiftEffectiveExp(porcelainCup, 144), 750, 'Porcelain cup should give 750 EXP to Chitose (+50%)');

// Chitose hates Star (Rising Star) -> disliked (gray face)
const risingStar = STELLA_SORA_GIFTS.find((g) => g.id === 'rising-star');
assert(risingStar, 'Rising star should exist');
assert.equal(isGiftHatedBy(risingStar, 144), true, 'Chitose should hate Rising Star');
assert.equal(getGiftAffinityMood(risingStar, 144), 'disliked', 'Rising star should have disliked (gray face) for Chitose');
assert.equal(getGiftEffectiveExp(risingStar, 144), 120, 'Rising star should give 120 EXP to Chitose (-20%)');

// Amber (103): loves Photo, Star; neutral on Love Candle
const amberFamilies = getCharacterFavoriteFamilies(103);
assert(amberFamilies.includes('Photo'), 'Amber should love Photo');
assert(amberFamilies.includes('Star'), 'Amber should love Star');

const cardCapturer = STELLA_SORA_GIFTS.find((g) => g.id === 'card-capturer');
assert(cardCapturer, 'Card capturer should exist');
assert.equal(isGiftLovedBy(cardCapturer, 103), true, 'Amber should love Card Capturer');
assert.equal(getGiftAffinityMood(cardCapturer, 103), 'loved', 'Card capturer should have loved mood for Amber');
assert.equal(getGiftEffectiveExp(cardCapturer, 103), 225, 'Card capturer should give 225 EXP to Amber (+50%)');

const loveCandle = STELLA_SORA_GIFTS.find((g) => g.id === 'love-candle');
assert(loveCandle, 'Love candle should exist');
assert.equal(isGiftLovedBy(loveCandle, 103), false, 'Amber does not especially love Love Candle');
assert.equal(isGiftHatedBy(loveCandle, 103), false, 'Amber does not hate Love Candle');
assert.equal(getGiftAffinityMood(loveCandle, 103), 'neutral', 'Love candle should have neutral (green face) for Amber');
assert.equal(getGiftEffectiveExp(loveCandle, 103), 150, 'Love candle gives standard 150 EXP to Amber');

// Sweet Ice Furry for Noya (112)
const sweetIce = STELLA_SORA_GIFTS.find((g) => g.id === 'sweet-ice-furry');
assert(sweetIce, 'Sweet Ice Furry should exist');
assert.equal(isGiftLovedBy(sweetIce, 112), true, 'Noya should love Sweet Ice Furry');
assert.equal(getGiftEffectiveExp(sweetIce, 112), 3000, 'Sweet Ice Furry should give 3000 EXP to Noya (+50%)');

// 6. Verify Bond Page UI contents
const bondPagePath = existsSync(resolve('blank/src/app/bond/page.tsx'))
  ? resolve('blank/src/app/bond/page.tsx')
  : resolve('src/app/bond/page.tsx');
const bondPage = readFileSync(bondPagePath, 'utf-8');
assert(bondPage.includes('Gift Allocation'), 'Window title should be Gift Allocation');
assert(!bondPage.includes('Auto-Fill Favorites'), 'Auto-Fill Favorites button should be removed per feedback');
assert(!bondPage.includes('Favorite Gifts:'), 'Favorite Gifts banner should be removed per feedback');
assert(bondPage.includes('STELLA_SORA_GIFTS'), 'Page should import and render STELLA_SORA_GIFTS');
assert(bondPage.includes('gift.name'), 'Page should render gift names');
assert(bondPage.includes('gift.imageUrl'), 'Page should render gift image picture');
assert(bondPage.includes('AffinityMoodFace'), 'Page should render AffinityMoodFace component');
assert(!bondPage.includes('Trekker Preference:'), 'Trekker Preference face mood legend should be removed per feedback');
assert(bondPage.includes('Days needed to send all gifts (10 gifts/day limit)'), 'Should calculate days based on 10 gifts/day');

console.log('✓ All Gifts Data & Integration assertions passed successfully!');
