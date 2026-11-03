# Automated Game Data Synchronization via Integrated ElysiaJS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate ElysiaJS into the Next.js App Router to automatically sync and serve the latest characters, potentials, and roadmap events with persistent local caching and graceful offline fallback.

**Architecture:** An integrated Elysia application mounted in `src/app/api/[[...slugs]]/route.ts` provides `/api/data/*` endpoints with TypeBox validation. A centralized Node.js sync engine (`src/lib/sync-engine.ts`) fetches upstream data from `raw.githubusercontent.com`, manages single-flight deduplicated requests, writes to a local `.data-cache/` directory, and serves read-only seed fallbacks if upstream is unavailable. Server Components invoke the engine directly in Node.js while Client Components query via Eden Treaty.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, ElysiaJS, @elysiajs/eden, Node.js `node:fs` / `node:path`.

**Spec:** [`docs/superpowers/specs/2026-10-29-elysia-data-sync-design.md`](file:///D:/Stuff/Projects/sstt/blank/docs/superpowers/specs/2026-10-29-elysia-data-sync-design.md)

## Global Constraints
- Target environment is local stateful Node.js (`.data-cache/` disk persistence and in-memory singleton cache).
- Handcrafted gift affinity mappings (`src/data/gifts.ts`) remain statically managed and are not overwritten by automated sync.
- Static data files in `src/data/` remain strictly immutable build-time seeds and are never mutated at runtime.
- Server Components must never execute self-referencing HTTP fetch calls to `http://localhost:.../api/*`.
- Upstream requests enforce a 5-second `AbortController` timeout and fall back to local seed data on any failure.

## Review Focus
- **Network timeout / offline execution:** Upstream fetch failure returns valid static seed data without hanging or throwing 500 errors.
- **Cache stampede under concurrent traffic:** Multiple simultaneous requests while cache is expired must share a single upstream request promise.
- **Corrupt upstream payload:** Upstream structural drift or malformed JSON is rejected and previous valid cache or seed data is served.
- **Cold start with missing `.data-cache`:** Application creates directory recursively if missing, or falls back gracefully to in-memory cache if unwritable.
- **Eden Treaty client type decoupling:** Type exports for Eden Treaty do not create circular dependency cycles with Next.js route handlers.

---

### Task 1: Scaffolding Dependencies & Cache Infrastructure

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `src/lib/cache-store.ts`
- Test: `tests/cache-store.test.mjs`

**Interfaces:**
- Produces: `readCache<T>(key: string): Promise<T | null>`, `writeCache<T>(key: string, data: T): Promise<void>`, `isCacheValid(key: string, ttlMs: number): boolean`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/cache-store.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readCache, writeCache, isCacheValid, clearCache } from '../src/lib/cache-store.ts';

test('writeCache stores data and readCache retrieves it', async () => {
  await writeCache('test-key', { foo: 'bar' });
  const result = await readCache('test-key');
  assert.deepEqual(result, { foo: 'bar' });
  assert.equal(isCacheValid('test-key', 60000), true);
  assert.equal(isCacheValid('test-key', -1), false);
  await clearCache();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --loader ts-node/esm tests/cache-store.test.mjs` (or `node --import tsx tests/cache-store.test.mjs`)
Expected: FAIL with module/function not found.

- [ ] **Step 3: Install `elysia` and `@elysiajs/eden`**

Run: `npm install elysia @elysiajs/eden`

- [ ] **Step 4: Implement `src/lib/cache-store.ts` and update `.gitignore`**

Add `.data-cache/` to `.gitignore`. Implement memory + disk cache reading/writing to `.data-cache/` with graceful fallback to `os.tmpdir()` if `.data-cache/` is unwritable.

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/cache-store.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore src/lib/cache-store.ts tests/cache-store.test.mjs
git commit -m "feat(cache): add disk and in-memory cache store and dependencies"
```

---

### Task 2: Core Data Sync Engine

**Files:**
- Create: `src/lib/sync-engine.ts`
- Test: `tests/sync-engine.test.mjs`

**Interfaces:**
- Consumes: `readCache`, `writeCache`, `isCacheValid` from `src/lib/cache-store.ts`
- Produces:
  - `getSyncedCharacters(): Promise<Record<string, SSCharacter>>`
  - `getSyncedPotentials(): Promise<any>`
  - `getSyncedRoadmap(): Promise<RoadmapItem[]>`
  - `triggerDataSync(): Promise<{ success: boolean; syncedAt: string; counts: Record<string, number> }>`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/sync-engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSyncedCharacters, getSyncedRoadmap, getSyncedPotentials } from '../src/lib/sync-engine.ts';

test('getSyncedCharacters returns character dictionary with Chitose', async () => {
  const chars = await getSyncedCharacters();
  assert.ok(chars && typeof chars === 'object');
  assert.ok(Object.values(chars).some(c => c.name?.EN === 'Chitose'));
});

test('getSyncedRoadmap returns valid roadmap items array', async () => {
  const items = await getSyncedRoadmap();
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
  assert.ok(items.some(i => i.id?.includes('chitose')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/sync-engine.test.mjs`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/sync-engine.ts`**

Implement `getSyncedCharacters`, `getSyncedPotentials`, `getSyncedRoadmap`, and `triggerDataSync`.
- Load static fallback seeds from `src/data/characters.json`, `src/data/potentials-db.json`, and `src/data/roadmap.ts`.
- Check cache validity (default TTL 6 hours).
- If expired, fetch upstream raw JSONs (`AutumnVN/ss-data`) using 5-second `AbortController`.
- Prevent duplicate concurrent fetches via single-flight Promise deduplication.
- On fetch failure or corrupt JSON, gracefully fall back to existing cache or seed data without throwing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/sync-engine.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-engine.ts tests/sync-engine.test.mjs
git commit -m "feat(sync): implement resilient game data sync engine"
```

---

### Task 3: Elysia Route Handlers & Eden API Setup

**Files:**
- Create: `src/lib/api/app.ts`
- Create: `src/app/api/[[...slugs]]/route.ts`
- Test: `tests/elysia-api.test.mjs`

**Interfaces:**
- Consumes: `getSyncedCharacters`, `getSyncedPotentials`, `getSyncedRoadmap`, `triggerDataSync` from `src/lib/sync-engine.ts`
- Produces: `app` (Elysia instance), `App` (type export for Eden), Next.js `GET` and `POST` handlers.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/elysia-api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/lib/api/app.ts';

test('Elysia /api/health responds with status ok', async () => {
  const res = await app.handle(new Request('http://localhost/api/health'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
});

test('Elysia /api/data/characters returns characters list', async () => {
  const res = await app.handle(new Request('http://localhost/api/data/characters'));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(typeof json === 'object');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/elysia-api.test.mjs`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/api/app.ts` and `src/app/api/[[...slugs]]/route.ts`**

Define the Elysia app with `/api/health`, `/api/data/characters`, `/api/data/roadmap`, `/api/data/potentials`, and `/api/sync`. Export `app` and `type App`. In `route.ts`, mount:
```typescript
import { app } from '@/lib/api/app';
export const GET = (req: Request) => app.fetch(req);
export const POST = (req: Request) => app.fetch(req);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/elysia-api.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/app.ts src/app/api/[[...slugs]]/route.ts tests/elysia-api.test.mjs
git commit -m "feat(api): mount ElysiaJS router in Next.js App Router"
```

---

### Task 4: Client Eden Hook & Server Component Direct Integration

**Files:**
- Create: `src/lib/api/client.ts`
- Modify: `src/app/roadmap/page.tsx`
- Modify: `src/app/trekkers/page.tsx`
- Modify: `src/app/builder/page.tsx`
- Modify: `src/components/home/trekker-spotlight.tsx`

**Interfaces:**
- Consumes: `App` from `src/lib/api/app.ts`, `treaty` from `@elysiajs/eden`, `getSyncedRoadmap` from `src/lib/sync-engine.ts`
- Produces: `apiClient` Eden instance, background sync updates across UI components.

- [ ] **Step 1: Write integration test verifying Server Component and Client Client contracts**

```javascript
// tests/client-eden.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSyncedRoadmap } from '../src/lib/sync-engine.ts';

test('Server Component direct invocation gets valid roadmap without network fetch', async () => {
  const roadmap = await getSyncedRoadmap();
  assert.ok(Array.isArray(roadmap));
  assert.ok(roadmap.length > 0);
});
```

- [ ] **Step 2: Create Eden client helper `src/lib/api/client.ts`**

```typescript
import { treaty } from '@elysiajs/eden';
import type { App } from './app';

export const api = typeof window !== 'undefined' 
  ? treaty<App>(window.location.origin).api 
  : null;
```

- [ ] **Step 3: Update `src/app/roadmap/page.tsx` (Server Component)**

Replace static direct import of `ROADMAP_ITEMS` with `await getSyncedRoadmap()`.

- [ ] **Step 4: Update `src/app/trekkers/page.tsx`, `src/app/builder/page.tsx`, and `trekker-spotlight.tsx` (Client Components)**

Use initial static seeds for instantaneous first paint. Add a lightweight background `useEffect` that calls `api.data.characters.get()` (and potentials) to quietly revalidate state if new items are present.

- [ ] **Step 5: Run tests and Next.js build verification**

Run: `npm run build`
Expected: PASS with 0 build errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/client.ts src/app/roadmap/page.tsx src/app/trekkers/page.tsx src/app/builder/page.tsx src/components/home/trekker-spotlight.tsx tests/client-eden.test.mjs
git commit -m "feat(ui): connect Server and Client components to synced data layer"
```

---

### Task 5: End-to-End Verification & Manual Sync Trigger

**Files:**
- Create: `tests/e2e-data-sync.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write E2E test verifying sync trigger and cache refresh**

Test `POST /api/sync`, verify that `.data-cache/` updates timestamps, and verify endpoints reflect updated data.

- [ ] **Step 2: Run E2E test**

Run: `node tests/e2e-data-sync.test.mjs`
Expected: PASS

- [ ] **Step 3: Update documentation in `README.md`**

Document the new ElysiaJS data synchronization architecture, `/api/data/*` endpoints, and `/api/sync` command.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e-data-sync.test.mjs README.md
git commit -m "docs(api): document ElysiaJS sync engine and add e2e verification"
```
