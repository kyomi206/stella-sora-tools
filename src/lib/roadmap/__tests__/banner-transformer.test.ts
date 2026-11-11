import test from 'node:test';
import assert from 'node:assert';
import {
  transformGachaBanners,
  transformUnreleasedTrekkers,
  cleanCharacterName,
  mapElementToColor,
  getDiscIconUrl,
  type RawGachaItem,
  type RawUnreleasedItem,
} from '../banner-transformer.ts';

test('getDiscIconUrl computes WikiTide disc icon URL', () => {
  assert.strictEqual(
    getDiscIconUrl(214004),
    'https://static.wikitide.net/stellasorawiki/0/0a/Disc_icon_Wisteria_Dream.png'
  );
  assert.strictEqual(
    getDiscIconUrl(224004),
    'https://static.wikitide.net/stellasorawiki/0/0a/Disc_icon_Wisteria_Dream.png'
  );
  assert.strictEqual(getDiscIconUrl(undefined), '');
});

test('cleanCharacterName sanitizes placeholder datamined names', () => {
  assert.strictEqual(cleanCharacterName('161 ***', 161), 'Upcoming Trekker #161');
  assert.strictEqual(cleanCharacterName('121 ', 121), 'Upcoming Trekker #121');
  assert.strictEqual(cleanCharacterName('Firefly', 115), 'Firefly');
});

test('mapElementToColor maps game elements to tailwind color themes', () => {
  assert.strictEqual(mapElementToColor('Ignis'), 'rose');
  assert.strictEqual(mapElementToColor('Aqua'), 'blue');
  assert.strictEqual(mapElementToColor('Terra'), 'orange');
  assert.strictEqual(mapElementToColor('Ventus'), 'emerald');
  assert.strictEqual(mapElementToColor('Umbra'), 'purple');
  assert.strictEqual(mapElementToColor('Lux'), 'amber');
  assert.strictEqual(mapElementToColor(undefined), 'blue');
});

test('transformGachaBanners pairs character banners with signature discs and 4★ rate-ups', () => {
  const sampleGacha: Record<string, RawGachaItem> = {
    '10110': {
      id: 10110,
      type: 'character',
      name: "Mirroring the Jade's Ideal",
      icon: 'tab_gacha_10110',
      rateUp5Star: [{ id: 110, name: 'Firenze', element: 'Umbra' }],
      rateUp4Star: [
        { id: 142, name: 'Cosette', element: 'Umbra' },
        { id: 116, name: 'Ridge', element: 'Terra' },
      ],
      startTime: '2026-01-13T12:00:00+08:00',
      endTime: '2026-02-03T10:59:59+08:00',
    },
    '20110': {
      id: 20110,
      type: 'disc',
      name: 'Fleeting Fragrance of Flowers',
      icon: 'tab_gacha_20110',
      rateUp5Star: [{ id: 214004, name: 'Wisteria Dream', element: 'Umbra' }],
      rateUp4Star: [],
      startTime: '2026-01-13T12:00:00+08:00',
      endTime: '2026-02-03T10:59:59+08:00',
    },
  };

  const items = transformGachaBanners(sampleGacha);
  assert.strictEqual(items.length, 2);

  const charBanner = items.find((i) => i.id === 'banner-gacha-10110');
  assert.ok(charBanner, 'Should have character banner');
  assert.strictEqual(charBanner?.characterName, 'Firenze');
  assert.strictEqual(charBanner?.colorTheme, 'purple');
  assert.strictEqual(charBanner?.rateUp4Star?.length, 2);
  assert.strictEqual(
    charBanner?.imageUrl,
    'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_11001_L.webp'
  );
  assert.strictEqual(charBanner?.pairedDisc?.name, 'Fleeting Fragrance of Flowers');
  assert.strictEqual(
    charBanner?.pairedDisc?.imageUrl,
    'https://static.wikitide.net/stellasorawiki/0/0a/Disc_icon_Wisteria_Dream.png'
  );

  const discBanner = items.find((i) => i.id === 'banner-gacha-20110');
  assert.ok(discBanner, 'Should have disc banner');
  assert.strictEqual(discBanner?.category, 'banners');
  assert.strictEqual(discBanner?.badge, 'RUNIC DISC');
  assert.strictEqual(
    discBanner?.imageUrl,
    'https://static.wikitide.net/stellasorawiki/0/0a/Disc_icon_Wisteria_Dream.png'
  );
  assert.strictEqual(
    discBanner?.bannerTabUrl,
    'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/gacha/tab_gacha_20110.webp'
  );
});

test('transformUnreleasedTrekkers filters and maps datamined unreleased entries', () => {
  const sampleUnreleased: Record<string, RawUnreleasedItem> = {
    '121': {
      id: 121,
      name: '121 ',
      element: 'Ignis',
      class: 'Vanguard',
      star: 0,
    },
    '161': {
      id: 161,
      name: '161 ***',
      element: 'Terra',
      class: 'Versatile',
      star: 0,
    },
  };

  const trekkers = transformUnreleasedTrekkers(sampleUnreleased);
  assert.strictEqual(trekkers.length, 2);
  assert.strictEqual(trekkers[0].displayName, 'Upcoming Trekker #121');
  assert.strictEqual(trekkers[0].element, 'Ignis');
  assert.strictEqual(trekkers[0].class, 'Vanguard');
  assert.strictEqual(trekkers[1].displayName, 'Upcoming Trekker #161');
});
