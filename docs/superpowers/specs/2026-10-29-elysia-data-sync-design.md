# Design Document: Automated Game Data Synchronization via Integrated ElysiaJS API

- **Date:** 2026-10-29
- **Project:** Stella Sora Tools (SSBS) — `D:\Stuff\Projects\sstt\blank`
- **Topic:** Integrated ElysiaJS Data Sync & Serving Layer
- **Status:** Pending Review

---

## 1. Intent and the "Why"
Stella Sora Tools currently hardcodes datamines and game records (characters, potentials, affinity gifts, and the roadmap timeline) into static files located in `src/data/`. When new character banners, raids, or affinity formulas arrive, updating the toolkit requires running manual local scripts and rebuilding the frontend.

The goal is to automatically synchronize and serve the newest game data across the web application using **ElysiaJS** integrated directly into the Next.js App Router, preserving full type safety, enabling zero-rebuild live updates, and maintaining instant offline fallbacks.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Automatic Background / On-Demand Sync:** Sync game datasets (characters, potentials, and roadmap events) from upstream repositories (e.g., `AutumnVN/ss-data`, StellaSora datamines).
- **Static Exclusions:** Handcrafted gift affinity mappings (`src/data/gifts.ts`) remain statically managed and are not overwritten by automated sync.
- **Local Environment Target:** Designed for local development and stateful local Node.js server execution (`.data-cache/` disk persistence and in-memory caching).
- **Integrated ElysiaJS Layer:** Run Elysia within Next.js Route Handlers (`src/app/api/[[...slugs]]/route.ts`), keeping deployment simple with a single unified codebase and no separate backend process.
- **Type-Safe API Consumption:** Provide end-to-end typed endpoints for the frontend (using Eden Treaty or type-safe fetchers) to query synced data (`/api/data/characters`, `/api/data/roadmap`, `/api/data/potentials`, `/api/sync`).
- **Graceful Offline Fallback:** If upstream repositories are unreachable or rate-limited, fall back seamlessly to local static snapshots so the site never breaks.
- **Cache Management:** Store synced data with an in-memory/disk cache layer (`.data-cache/`) with an automatic Time-To-Live (TTL) revalidation mechanism.

### Non-Goals
- Running a separate standalone daemon process or database server (e.g. external PostgreSQL, Redis).
- Replacing the client-side calculator algorithms (e.g., the bond calculator math, squad builder state machine, and image card exporter remain client-side, consuming synced dataset inputs).
- User authentication or personalized saved team builds (focused strictly on game data synchronization).

### Anti-Goals
- Breaking static builds or introducing flaky network dependencies during Next.js build time.
- Altering existing UI layouts, design tokens, or verified English terminology.

---

## 3. Approaches Considered

### Approach A: Standalone ElysiaJS Daemon / Bun Server (Rejected)
- **Concept:** A separate backend repository or process running Bun + Elysia on port 3001 with background `cron()`.
- **Why Rejected:** Adds deployment friction, requires multiple running services, and the local environment currently lacks Bun (`bun` command not found). The user explicitly selected the unified integrated approach.

### Approach B: Standard Next.js Route Handlers without Elysia (Rejected)
- **Concept:** Plain Next.js route handlers (`export async function GET()`).
- **Why Rejected:** Does not fulfill the user's objective to utilize ElysiaJS, lacks Elysia's schema validation (`t.Object`), plugin ecosystem, and Eden end-to-end type safety.

### Approach C: Integrated ElysiaJS in Next.js App Router (Selected)
- **Concept:** Elysia instance mounted inside Next.js Catch-All Route Handler (`src/app/api/[[...slugs]]/route.ts`).
- **Why Chosen:** Single server deployment (`npm run dev` / `npm start`), zero extra infrastructure, instant compatibility with Vercel/Node.js runtimes, and utilizes Elysia's syntax, route validation, and Eden client capabilities.

---

## 4. Architecture & Technical Design

### 4.1 Route Handler & Elysia Structure
- **Path:** `src/app/api/[[...slugs]]/route.ts` (with decoupled Elysia app definition in `src/lib/api/app.ts` for clean Eden type exports).
- **Implementation:**
  ```typescript
  import { Elysia, t } from 'elysia';
  import { 
    getSyncedCharacters, 
    getSyncedRoadmap, 
    getSyncedPotentials, 
    triggerDataSync 
  } from '@/lib/sync-engine';

  export const app = new Elysia({ prefix: '/api' })
    .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))
    .get('/data/characters', async () => getSyncedCharacters())
    .get('/data/roadmap', async () => getSyncedRoadmap())
    .get('/data/potentials', async () => getSyncedPotentials())
    .post('/sync', async ({ headers, set }) => {
      const auth = headers['authorization'];
      if (process.env.SYNC_SECRET && auth !== `Bearer ${process.env.SYNC_SECRET}`) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      return triggerDataSync();
    });

  export type App = typeof app;

  // Next.js Route Handler adapter
  export const GET = (req: Request) => app.fetch(req);
  export const POST = (req: Request) => app.fetch(req);
  ```

### 4.2 Data Fetching & Sync Engine (`src/lib/sync-engine.ts`)
- **Upstream Sources:**
  - `AutumnVN/ss-data`: `gacha.json`, `unreleased.json`, `blitz.json`
  - Datamined Character & Potentials: Raw GitHub mirrors of `characters.json` and `potentials-db.json`
- **Cache Strategy:**
  - **In-Memory & Persistent Storage:** In-memory singleton with fallback to disk cache (`.data-cache/` or OS temp directory if read-only).
  - **Single-Flight Fetch:** Deduplicated in-flight promises to prevent cache stampedes under concurrent traffic.
  - **Read-Only Seeds:** Files in `src/data/` remain strictly immutable build-time seeds and are never mutated at runtime.
  - **Timeout & Resilience:** 5-second timeout via `AbortController` and fallback to local seed data if upstream fails.

### 4.3 Data Layer Consumption (Server Components vs. Client Components)
- **Server Components** (`/roadmap`, initial page SSR):
  - Call `getSyncedRoadmap()` or `getSyncedCharacters()` directly in Node.js runtime—**no self-referencing HTTP loopback calls**.
- **Client Components & Interactive Tools** (`/builder`, `/trekkers`, `/bond`, `/calculator`, `TrekkerSpotlight`):
  - Initialized with static seed data for instant, zero-flicker first paint.
  - Silently fetch `/api/data/*` via Eden Treaty in the background to update state if newer data is available.

---

## 5. Implementation Boundaries & What's Left to Builder
- **Dependencies:** Add `elysia`, `@elysiajs/eden`.
- **Validation:** TypeBox schemas for sync requests and responses.
- **Error Handling:** Resilient retry logic with timeouts for upstream fetch calls.
- **Tests:** Add unit and integration tests verifying API endpoint responses and fallback behaviors.
