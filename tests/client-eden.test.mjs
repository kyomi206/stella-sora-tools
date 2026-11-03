import test from 'node:test';
import assert from 'node:assert/strict';

test('Server Component direct invocation gets valid roadmap without network fetch', async () => {
  const { getSyncedRoadmap } = await import('../src/lib/sync-engine.ts');
  const roadmap = await getSyncedRoadmap();
  assert.ok(Array.isArray(roadmap));
  assert.ok(roadmap.length > 0);
  assert.ok(roadmap.some(item => item.title?.toLowerCase().includes('chitose') || item.id?.includes('chitose')));
});
