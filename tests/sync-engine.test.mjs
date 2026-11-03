import test from 'node:test';
import assert from 'node:assert/strict';

test('getSyncedCharacters returns character dictionary with Chitose', async () => {
  const { getSyncedCharacters } = await import('../src/lib/sync-engine.ts');
  const chars = await getSyncedCharacters();
  assert.ok(chars && typeof chars === 'object');
  assert.ok(Object.values(chars).some(c => c.name?.EN === 'Chitose'));
});

test('getSyncedRoadmap returns valid roadmap items array', async () => {
  const { getSyncedRoadmap } = await import('../src/lib/sync-engine.ts');
  const items = await getSyncedRoadmap();
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
  assert.ok(items.some(i => i.title?.toLowerCase().includes('chitose') || i.id?.includes('chitose')));
});

test('getSyncedPotentials returns valid potentials dataset', async () => {
  const { getSyncedPotentials } = await import('../src/lib/sync-engine.ts');
  const potentials = await getSyncedPotentials();
  assert.ok(potentials && typeof potentials === 'object');
});
