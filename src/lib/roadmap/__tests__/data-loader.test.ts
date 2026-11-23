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

  // Verify Version 2.1 schedule entries & Boss Blitz enrichment are loaded
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const blitzS13 = byId.get('blitz-s13-nov26');
  assert.ok(blitzS13, 'Must include Boss Blitz Season 13');
  assert.ok(blitzS13.mechanics && blitzS13.mechanics.length > 0, 'Boss Blitz S13 should be enriched with datamined mechanics');
  assert.ok(byId.has('event-map-uncharted-nov26'), 'Must include Version 2.1 flagship event');
  assert.ok(byId.has('event-joint-drill-s8-nov26'), 'Must include Joint Drill Season 8');
  assert.ok(byId.has('story-sp2-reunion-dawn-part2-nov26'), 'Must include Special Chapter Second Half');
  assert.ok(byId.has('cataclysm-p18-nov26'), 'Must include Cataclysm Survivor Phase 18');

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
