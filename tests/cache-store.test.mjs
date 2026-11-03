import test from 'node:test';
import assert from 'node:assert/strict';

test('writeCache stores data and readCache retrieves it', async () => {
  const { readCache, writeCache, isCacheValid, clearCache } = await import('../src/lib/cache-store.ts');
  await writeCache('test-key', { foo: 'bar' });
  const result = await readCache('test-key');
  assert.deepEqual(result, { foo: 'bar' });
  assert.equal(isCacheValid('test-key', 60000), true);
  assert.equal(isCacheValid('test-key', -1), false);
  await clearCache();
});
