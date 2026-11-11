import test from 'node:test';
import assert from 'node:assert';
import { getMergedRoadmapItems, getDataminedUnreleasedTrekkers } from '../data-loader.ts';

test('getMergedRoadmapItems combines datamined banners with static roadmap items', () => {
  const allItems = getMergedRoadmapItems();
  assert.ok(allItems.length > 30, `Should load all merged roadmap items, got ${allItems.length}`);

  const categories = new Set(allItems.map((i) => i.category));
  assert.ok(categories.has('banners'), 'Must contain banners');
  assert.ok(categories.has('events'), 'Must contain events');
  assert.ok(categories.has('bossBlitz'), 'Must contain bossBlitz');
  assert.ok(categories.has('cataclysm'), 'Must contain cataclysm');

  // Verify chronological ordering
  for (let i = 1; i < allItems.length; i++) {
    const prev = new Date(allItems[i - 1].startDate).getTime();
    const curr = new Date(allItems[i].startDate).getTime();
    assert.ok(curr >= prev, `Items should be chronologically sorted: index ${i} (${allItems[i - 1].title} vs ${allItems[i].title})`);
  }
});

test('getDataminedUnreleasedTrekkers returns unreleased character list', () => {
  const unreleased = getDataminedUnreleasedTrekkers();
  assert.ok(Array.isArray(unreleased));
  assert.ok(unreleased.length > 0);
  assert.ok(unreleased.every((u) => u.displayName.startsWith('Upcoming Trekker')));
});
