import test from 'node:test';
import assert from 'node:assert/strict';

test('Elysia /api/health responds with status ok', async () => {
  const { app } = await import('../src/lib/api/app.ts');
  const res = await app.handle(new Request('http://localhost/api/health'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
});

test('Elysia /api/data/characters returns characters dictionary', async () => {
  const { app } = await import('../src/lib/api/app.ts');
  const res = await app.handle(new Request('http://localhost/api/data/characters'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(typeof json === 'object');
  assert.ok(Object.values(json).some(c => c.name?.EN === 'Chitose'));
});

test('Elysia /api/data/roadmap returns roadmap items', async () => {
  const { app } = await import('../src/lib/api/app.ts');
  const res = await app.handle(new Request('http://localhost/api/data/roadmap'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(Array.isArray(json));
  assert.ok(json.length > 0);
});
