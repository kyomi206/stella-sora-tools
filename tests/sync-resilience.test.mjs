import test from 'node:test';
import assert from 'node:assert/strict';

test('triggerDataSync with force actually queries upstream when forced', async () => {
  const { triggerDataSync, getSyncedCharacters } = await import('../src/lib/sync-engine.ts');
  const { clearCache } = await import('../src/lib/cache-store.ts');
  await clearCache();
  
  // Populate cache with dummy
  const { writeCache } = await import('../src/lib/cache-store.ts');
  await writeCache('characters_data', { dummy: { id: 999, name: { EN: 'Dummy' } } });
  
  // Normal get should return dummy because it is cached
  const initial = await getSyncedCharacters();
  assert.equal(initial.dummy?.name?.EN, 'Dummy');
  
  // triggerDataSync with force: true must overwrite dummy by fetching/loading real seed
  await triggerDataSync({ force: true });
  const refreshed = await getSyncedCharacters();
  assert.equal(refreshed.dummy, undefined);
  assert.ok(refreshed['144']?.name?.EN === 'Chitose');
  
  // Clean up cache after test so other test runners start clean
  await clearCache();
});
