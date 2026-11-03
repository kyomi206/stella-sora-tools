# Datamined Roadmap Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Stella Sora Events Roadmap (`/roadmap`) with automated datamined recruitment banner schedules, companion Runic Discs, 4★ rate-up rosters, Boss Blitz raid boss mechanics, and unreleased Trekker teasers from `AutumnVN/ss-data`.

**Architecture:** A dedicated sync script extracts and normalizes raw GitHub datamined JSONs into structured static datasets. A pure transformation layer (`banner-transformer.ts`) maps raw data into strongly typed `RoadmapItem` models with companion disc pairing, element color mapping, and rate-up rosters. The timeline and modal components are updated with rate-up badges, quick status filters (Active/Upcoming), a "Jump to Active" button, and an unreleased character teaser shelf.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Lucide React, Node.js built-in test runner (`node --test`).

**Spec:** Integration of `https://github.com/AutumnVN/ss-data` datamined datasets (`gacha.json`, `unreleased.json`, `blitz.json`) and `AutumnVN/ssassets` CDN URLs into Stella Sora Tools Events Roadmap (`/roadmap`).

## Global Constraints

- **Node 24 Native Tooling:** Use Node 24 native test runner (`node --test`) for lightning-fast testing without adding heavy testing dependencies.
- **CDN Asset Convention:** Trekker portraits adhere to `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${characterId}01_XL.webp`.
- **Preserve Interactive Roadmap UX:** Timeline drag-to-pan, wheel zoom, and category filtering must remain responsive and performant with 60+ datamined banners.
- **Backward Compatibility:** All existing story event, Cataclysm, and Boss Blitz milestones in `blank/src/data/roadmap.ts` must remain available and smoothly coexist with synced data.
- **Non-breaking Fallbacks:** Missing character portraits, placeholder names (`***`), or missing rate-up rosters must fail gracefully to placeholders without throwing runtime errors.

## Review Focus

1. **Timezone & Date Parsing:** `startTime` and `endTime` strings from `gacha.json` use UTC+8 offsets (`+08:00`); ensure timestamps parse correctly across browser locales without 1-day off-by-one errors.
2. **Paired Disc Matching:** Disc banners match character banners by exact time interval; ensure unpaired discs or standalone rerun banners don't cause pairing crashes.
3. **Placeholder Trekker Sanitization:** Unreleased character names such as `"161 ***"` or `"121 "` must be formatted cleanly as `"Upcoming Trekker (ID #161)"` rather than displaying raw datamined asterisks.
4. **Lane Packing Density:** 66+ datamined banners spanning October 2025 through November 2026 must pack cleanly into staggered horizontal lanes without overflowing or visual clipping.
5. **Mobile Responsiveness:** Ensure the enriched modal details with 4★ rate-up avatars and boss mechanics scrolls cleanly on mobile screens without viewport squishing.

---

### Task 1: Core Type Definitions & Data Transformer with Unit Tests

**Files:**
- Create: `blank/src/lib/roadmap/types.ts`
- Create: `blank/src/lib/roadmap/banner-transformer.ts`
- Test: `blank/src/lib/roadmap/__tests__/banner-transformer.test.ts`

**Interfaces:**
- Consumes: Raw datamined JSON objects from `ss-data` (`RawGachaItem`, `RawUnreleasedItem`, `RawBlitzItem`).
- Produces:
  - `transformGachaBanners(rawGacha: Record<string, RawGachaItem>): RoadmapItem[]`
  - `transformUnreleasedTrekkers(rawUnreleased: Record<string, RawUnreleasedItem>): UnreleasedTrekker[]`
  - `cleanCharacterName(rawName: string, id: number): string`
  - `mapElementToColor(element?: string): 'purple' | 'amber' | 'blue' | 'rose' | 'emerald' | 'orange' | 'indigo'`

- [ ] **Step 1: Write the failing unit tests for banner transformation**

Write tests covering:
1. Converting raw character banner to `RoadmapItem` with correct element, title, and dates.
2. Pairing a character banner with its corresponding signature Runic Disc banner occurring in the same time window.
3. Extracting 4★ rate-up characters (`rateUp4Star`).
4. Sanitizing datamined placeholder names (`"161 ***"` -> `"Upcoming Trekker (ID #161)"`).
5. Fallback behavior when 5★ rate-up list is empty.

Create `blank/src/lib/roadmap/__tests__/banner-transformer.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert';
import {
  transformGachaBanners,
  cleanCharacterName,
  mapElementToColor,
  type RawGachaItem,
} from '../banner-transformer.js';

test('cleanCharacterName sanitizes placeholder datamined names', () => {
  assert.strictEqual(cleanCharacterName('161 ***', 161), 'Upcoming Trekker #161');
  assert.strictEqual(cleanCharacterName('121 ', 121), 'Upcoming Trekker #121');
  assert.strictEqual(cleanCharacterName('Firefly', 115), 'Firefly');
});

test('mapElementToColor maps game elements to tailwind color themes', () => {
  assert.strictEqual(mapElementToColor('Ignis'), 'rose');
  assert.strictEqual(mapElementToColor('Aqua'), 'blue');
  assert.strictEqual(mapElementToColor('Terra'), 'orange');
  assert.strictEqual(mapElementToColor('Ventus'), 'emerald');
  assert.strictEqual(mapElementToColor('Umbra'), 'purple');
  assert.strictEqual(mapElementToColor('Lux'), 'amber');
});

test('transformGachaBanners pairs character banners with signature discs and 4★ rate-ups', () => {
  const sampleGacha: Record<string, RawGachaItem> = {
    '10110': {
      id: 10110,
      type: 'character',
      name: "Mirroring the Jade's Ideal",
      icon: 'tab_gacha_10110',
      rateUp5Star: [{ id: 110, name: 'Firenze', element: 'Umbra' }],
      rateUp4Star: [
        { id: 142, name: 'Cosette', element: 'Umbra' },
        { id: 116, name: 'Ridge', element: 'Terra' },
      ],
      startTime: '2026-01-13T12:00:00+08:00',
      endTime: '2026-02-03T10:59:59+08:00',
    },
    '20110': {
      id: 20110,
      type: 'disc',
      name: 'Fleeting Fragrance of Flowers',
      icon: 'tab_gacha_20110',
      rateUp5Star: [{ id: 31034, name: 'Fleeting Fragrance', element: 'Umbra' }],
      rateUp4Star: [],
      startTime: '2026-01-13T12:00:00+08:00',
      endTime: '2026-02-03T10:59:59+08:00',
    },
  };

  const items = transformGachaBanners(sampleGacha);
  assert.strictEqual(items.length, 2);

  const charBanner = items.find((i) => i.id === 'banner-gacha-10110');
  assert.ok(charBanner);
  assert.strictEqual(charBanner.characterName, 'Firenze');
  assert.strictEqual(charBanner.colorTheme, 'purple');
  assert.strictEqual(charBanner.rateUp4Star?.length, 2);
  assert.strictEqual(charBanner.pairedDisc?.name, 'Fleeting Fragrance of Flowers');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test blank/src/lib/roadmap/__tests__/banner-transformer.test.ts`
Expected: FAIL (Cannot find module `../banner-transformer.js` or types)

- [ ] **Step 3: Implement types and transformer in `blank/src/lib/roadmap/`**

Create `blank/src/lib/roadmap/types.ts`:
- Define `RawGachaItem`, `RawUnreleasedItem`, `RawBlitzItem`.
- Define extended `RoadmapItem` with `rateUp4Star`, `pairedDisc`, `isDatamined`, and `mechanics`.
- Define `UnreleasedTrekker`.

Create `blank/src/lib/roadmap/banner-transformer.ts`:
- Implement `cleanCharacterName`, `mapElementToColor`, `transformGachaBanners`, `transformUnreleasedTrekkers`.
- Support pairing discs by matching timestamp ranges.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test blank/src/lib/roadmap/__tests__/banner-transformer.test.ts`
Expected: PASS with 3 passing tests.

---

### Task 2: Datamined Data Sync Script & Static Datasets

**Files:**
- Create: `blank/scripts/sync-roadmap-data.mjs`
- Create: `blank/src/data/datamined-banners.json`
- Create: `blank/src/data/datamined-unreleased.json`
- Create: `blank/src/data/datamined-blitz.json`
- Create: `blank/src/lib/roadmap/data-loader.ts`
- Test: `blank/src/lib/roadmap/__tests__/data-loader.test.ts`

**Interfaces:**
- Consumes: Datamined raw files from GitHub (`AutumnVN/ss-data`).
- Produces:
  - `syncRoadmapData()` CLI script that writes pre-transformed JSON files into `blank/src/data/`.
  - `getMergedRoadmapItems(): RoadmapItem[]` which joins datamined banners with existing story events & cataclysm schedules.

- [ ] **Step 1: Write test for `data-loader.ts`**

Create `blank/src/lib/roadmap/__tests__/data-loader.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert';
import { getMergedRoadmapItems } from '../data-loader.js';

test('getMergedRoadmapItems combines datamined banners with static roadmap items', () => {
  const allItems = getMergedRoadmapItems();
  assert.ok(allItems.length > 30, 'Should load all merged roadmap items');

  const categories = new Set(allItems.map((i) => i.category));
  assert.ok(categories.has('banners'), 'Must contain banners');
  assert.ok(categories.has('events'), 'Must contain events');
  assert.ok(categories.has('bossBlitz'), 'Must contain bossBlitz');
  assert.ok(categories.has('cataclysm'), 'Must contain cataclysm');

  // Verify chronological ordering
  for (let i = 1; i < allItems.length; i++) {
    const prev = new Date(allItems[i - 1].startDate).getTime();
    const curr = new Date(allItems[i].startDate).getTime();
    assert.ok(curr >= prev, `Items should be chronologically sorted: index ${i}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test blank/src/lib/roadmap/__tests__/data-loader.test.ts`
Expected: FAIL (`data-loader.js` not found)

- [ ] **Step 3: Implement `scripts/sync-roadmap-data.mjs`**

Implement Node script that:
1. Fetches `https://raw.githubusercontent.com/AutumnVN/ss-data/main/gacha.json`.
2. Fetches `https://raw.githubusercontent.com/AutumnVN/ss-data/main/unreleased.json`.
3. Fetches `https://raw.githubusercontent.com/AutumnVN/ss-data/main/blitz.json`.
4. Saves them to `blank/src/data/datamined-banners.json`, `blank/src/data/datamined-unreleased.json`, and `blank/src/data/datamined-blitz.json`.
5. Executes the sync script once to populate local datasets.

- [ ] **Step 4: Implement `blank/src/lib/roadmap/data-loader.ts`**

Load datamined JSONs, run them through `transformGachaBanners`, merge with non-banner static items (events, cataclysm, main story) from `blank/src/data/roadmap.ts`, deduplicate, and sort chronologically.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test blank/src/lib/roadmap/__tests__/data-loader.test.ts`
Expected: PASS with all items loaded and sorted.

---

### Task 3: Enhanced Modal Details Component with Rate-Up & Boss Blitz Breakdown

**Files:**
- Modify: `blank/src/components/roadmap/roadmap-item-details.tsx`
- Test: `blank/src/lib/roadmap/__tests__/modal-details-formatting.test.ts`

**Interfaces:**
- Consumes: Enriched `RoadmapItem` from Task 1 & 2.
- Produces: Enhanced `RoadmapItemDetails` modal displaying:
  - 5★ rate-up trekker portrait with element glow.
  - 4★ rate-up roster avatars and element tags.
  - Companion signature Runic Disc box with link to paired disc.
  - Boss Blitz weakness badges, resistance tags, and mechanics cards.
  - Direct navigation button to "Resource Calculator" or "Team Builder".

- [ ] **Step 1: Write unit tests for modal formatting helpers**

Create `blank/src/lib/roadmap/__tests__/modal-details-formatting.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert';
import { formatRoadmapRemainingTime, getElementBadgeColor } from '../banner-transformer.js';

test('formatRoadmapRemainingTime formats active and upcoming days', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const future = new Date('2026-10-29T12:00:00Z');
  const past = new Date('2026-10-20T12:00:00Z');

  assert.strictEqual(formatRoadmapRemainingTime(future, now, 'upcoming'), 'Starts in 3 days');
  assert.strictEqual(formatRoadmapRemainingTime(future, now, 'ongoing'), '3 days left');
  assert.strictEqual(formatRoadmapRemainingTime(past, now, 'ended'), 'Ended');
});
```

- [ ] **Step 2: Run test to verify it passes or implement formatting helpers**

Run: `node --test blank/src/lib/roadmap/__tests__/modal-details-formatting.test.ts`
Implement `formatRoadmapRemainingTime` and `getElementBadgeColor` in `banner-transformer.ts`.

- [ ] **Step 3: Update `blank/src/components/roadmap/roadmap-item-details.tsx`**

1. Render rate-up 5★ portrait using `getTrekkerAvatarUrl(item.characterId)`.
2. Add "Featured 4★ Trekkers" section when `item.rateUp4Star` is present with mini heads and element pills.
3. Add "Companion Signature Disc" section when `item.pairedDisc` is present.
4. Add "Boss Blitz Mechanics" section when `item.mechanics` is present with damage point tags and vulnerability chips.
5. Add action button: "Open in Calculator" (links to `/calculator?trekker=${item.characterName}` if trekker exists).

---

### Task 4: Interactive Timeline UI Enhancements (Jump to Active, Sub-Filters & Unreleased Shelf)

**Files:**
- Create: `blank/src/components/roadmap/unreleased-trekkers-bar.tsx`
- Modify: `blank/src/components/roadmap/roadmap-timeline.tsx`
- Modify: `blank/src/app/roadmap/page.tsx`

**Interfaces:**
- Consumes: `getMergedRoadmapItems()`, `datamined-unreleased.json`.
- Produces:
  - Timeline with "Jump to Today / Active" button.
  - Category filters: All, Trekkers, Discs, Boss Blitz, Events, Cataclysm.
  - Status filters: All, Active Now, Upcoming, Past.
  - Unreleased Trekkers teaser drawer component.

- [ ] **Step 1: Create `unreleased-trekkers-bar.tsx`**

Create component that:
- Reads unreleased Trekkers from `datamined-unreleased.json`.
- Displays a stylish teaser drawer: "Datamined / Future Trekkers in Game Files".
- Displays unit cards with placeholder avatar, class badge (Vanguard, Versatile), element badge, and datamined release hints.
- Includes a crystal saving reminder ("Start saving Stellanite Dust & Crystals!").

- [ ] **Step 2: Update `roadmap-timeline.tsx`**

1. Switch `ROADMAP_ITEMS` source to `getMergedRoadmapItems()`.
2. Add "Jump to Active" button in the zoom/filter header:
   - Finds current date (`now`) position on the timeline in pixels (`(now - RANGE_START) / DAY_MS * dayWidth`).
   - Smoothly animates `scrollContainerRef.current.scrollTo({ left: targetX - containerWidth / 2, behavior: 'smooth' })`.
3. Add status filter pills (`All`, `Active Now`, `Upcoming`).
4. Enhance item timeline cards:
   - For character recruitment banners, show 5★ portrait and mini 4★ dots.
   - For disc banners, show disc badge.
   - Highlight active banners with animated pulse dot.

- [ ] **Step 3: Update `blank/src/app/roadmap/page.tsx`**

1. Update top statistics pill counts dynamically based on active items.
2. Render `<UnreleasedTrekkersBar />` beneath `<RoadmapTimeline />`.

---

### Task 5: Verification & End-to-End Testing

**Files:**
- Run: `node --test blank/src/lib/roadmap/__tests__/*.test.ts`
- Run: `npx tsc --noEmit`
- Test: Verify `http://localhost:3000/roadmap` renders without errors

- [ ] **Step 1: Run complete test suite**

Run: `node --test blank/src/lib/roadmap/__tests__/banner-transformer.test.ts blank/src/lib/roadmap/__tests__/data-loader.test.ts blank/src/lib/roadmap/__tests__/modal-details-formatting.test.ts`
Expected: ALL TESTS PASS (0 failures).

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npx tsc --noEmit` (inside `blank/`)
Expected: Exit code 0 with 0 type errors.

- [ ] **Step 3: Verify `/roadmap` HTTP response**

Run a curl or fetch script against `http://localhost:3000/roadmap`:
Expected: HTTP 200 OK, HTML contains "Events Roadmap", datamined banner titles (e.g. "Firefly", "Firstlight Noya", "Mirroring the Jade's Ideal"), and unreleased trekker section.
