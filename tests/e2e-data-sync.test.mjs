import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SYNC_SECRET = 'test-secret';

test('End-to-end sync verification: /api/sync triggers data refresh and updates cache', async () => {
  const { app } = await import('../src/lib/api/app.ts');
  const { readCache } = await import('../src/lib/cache-store.ts');

  // 1. Check health
  const healthRes = await app.handle(new Request('http://localhost/api/health'));
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.status, 'ok');

  // 2. Trigger sync
  const syncRes = await app.handle(new Request('http://localhost/api/sync', { method: 'POST', headers: { authorization: 'Bearer test-secret' } }));
  assert.equal(syncRes.status, 200);
  const syncJson = await syncRes.json();
  assert.equal(syncJson.success, true);
  assert.ok(syncJson.counts.characters > 0);
  assert.ok(syncJson.counts.roadmapItems > 0);

  // 3. Verify data in cache store
  const cachedChars = await readCache('characters_data');
  assert.ok(cachedChars !== null);
  assert.ok(Object.values(cachedChars).some(c => c.name?.EN === 'Chitose'));

  // 4. Query characters endpoint
  const charRes = await app.handle(new Request('http://localhost/api/data/characters'));
  assert.equal(charRes.status, 200);
  const chars = await charRes.json();
  assert.ok(Object.keys(chars).length >= 10);
});
