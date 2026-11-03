# Refined Celestial Dark UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Stella Sora Tools with a Refined Celestial Dark visual identity, unified mobile/desktop navigation, balanced Home page cards, and harmonized Bond & Resource Calculator controls.

**Architecture:** Enhance `src/app/globals.css` with celestial ambient backdrop lighting, elevated card/panel utility classes (top-edge specular border highlight + depth shadow), and custom range slider styles while preserving existing root token hexes. Update layout, home, builder, calculator, roadmap, and encyclopedia components in place with zero new npm dependencies.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide React, Node `node:test` runner.

**Spec:** `docs/superpowers/specs/2026-10-31-celestial-dark-ui-polish-design.md`

## Global Constraints

- Preserve root token declarations in `src/app/globals.css`: `--color-base: #0c0e12`, `--color-surface: #131720`, `--color-border: #23293a`, `--color-accent: #f59e0b`, and `font-family: var(--font-sans)`.
- Never use `transition-all` anywhere in `src/` (enforced by `tests/ui-transitions.test.mjs`); always specify explicit properties such as `transition-[border-color,background-color,box-shadow,color]`.
- Never use `bg-clip-text text-transparent` in `src/app/page.tsx`, `bg-gradient-to-b` in `src/components/home/tools-grid.tsx`, or `bg-gradient-to-r` in `src/app/builder/page.tsx` (enforced by existing audit tests).
- Maintain WCAG AA contrast, `:focus-visible` rings, `aria-label` attributes on icon/stepper buttons, and `prefers-reduced-motion` compliance.
- Do not install new npm dependencies.

## Review Focus

1. **Duplicate mobile header regression:** On `< 768px` viewports, `SideTab` must not render a separate top bar above `TopBar`; `TopBar` alone renders the mobile brand, current page breadcrumb, and drawer toggle button.
2. **TrekkerSelector subtitle & 5★ parity:** Passing `subtitle="..."` to `<TrekkerSelector />` on `/bond` and `/calculator` must render that exact string instead of hardcoded copy, and 5★ Trekker cards in `TrekkerSelector` must use the prismatic gradient (`from-[#c084fc] via-[#818cf8] to-[#38bdf8]`).
3. **Bond Calculator level slider & stepper parity:** Changing `currentLevel` via the new `- / +` stepper buttons or amber range slider on `/bond` must clamp `currentLevel` to `1..98` and automatically bump `targetLevel` to `currentLevel + 1` when `currentLevel >= targetLevel`.
4. **Home page 5-card grid alignment:** The 5th tool card (`Trekker Encyclopedia`) in `ToolsGrid` must span 2 columns (`md:col-span-2`) on desktop so no orphan half-row gap remains.
5. **Existing test suite compatibility:** All existing `.test.mjs` files in `tests/` (including `tokens-and-layout.test.mjs`, `ui-transitions.test.mjs`, `final-design-audit.test.mjs`, `builder-layout.test.mjs`) must continue to pass.

---

### Task 1: Celestial Dark CSS Tokens, Surface Utilities &Unified Navigation (`globals.css`, `side-tab.tsx`, `top-bar.tsx`)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/side-tab.tsx`
- Modify: `src/components/layout/top-bar.tsx`
- Create: `tests/celestial-nav-and-tokens.test.mjs`

**Interfaces:**
- Produces CSS utility classes in `src/app/globals.css`:
  - `.celestial-card`: elevated card surface with top-edge inner specular highlight (`box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06), 0 8px 24px -8px rgba(0, 0, 0, 0.5)`)
  - `.celestial-slider`: styled range input (`accent-amber-500 bg-slate-800/90 h-1.5 rounded-lg cursor-pointer`)
- Updates `SideTab` and `TopBar` so `SideTab` no longer renders a duplicate `<div className="md:hidden sticky top-0 ...">` header bar, and `TopBar` renders the mobile brand icon + breadcrumb + mobile menu toggle alongside the desktop sidebar collapse button.

- [ ] **Step 1: Write the failing test in `tests/celestial-nav-and-tokens.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('globals.css defines celestial surface utilities and preserves core tokens', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  assert.ok(css.includes('--color-base: #0c0e12'), 'Must preserve --color-base');
  assert.ok(css.includes('.celestial-card'), 'Must define .celestial-card utility');
  assert.ok(css.includes('.celestial-slider'), 'Must define .celestial-slider utility');
  assert.ok(css.includes('radial-gradient'), 'Body must include subtle celestial radial backdrop');
});

test('navigation merges mobile header into TopBar and adds amber active indicator to SideTab', () => {
  const sideTab = fs.readFileSync('src/components/layout/side-tab.tsx', 'utf8');
  const topBar = fs.readFileSync('src/components/layout/top-bar.tsx', 'utf8');

  assert.ok(!sideTab.includes('md:hidden sticky top-0'), 'SideTab must not render a duplicate sticky mobile header');
  assert.ok(sideTab.includes('border-amber-400'), 'SideTab active link must use warm amber indicator');
  assert.ok(topBar.includes('/bastelina.png'), 'TopBar must display mobile brand logo on small viewports');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/celestial-nav-and-tokens.test.mjs`
Expected: FAIL (`Must define .celestial-card utility`)

- [ ] **Step 3: Implement Celestial Dark utilities in `src/app/globals.css` and unified navigation in `src/components/layout/side-tab.tsx` & `src/components/layout/top-bar.tsx`**

In `src/app/globals.css`:
- Keep `:root` and `@theme inline` token hex values untouched.
- Add a subtle non-intrusive radial background image on `body`:
  `background-image: radial-gradient(ellipse 80% 50% at 50% -15%, rgba(99, 102, 241, 0.10), rgba(245, 158, 11, 0.04) 45%, transparent 80%); background-attachment: fixed;`
- Define `.celestial-card` (with `background-color: var(--color-surface-card); border: 1px solid var(--color-border-subtle); box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06), 0 6px 20px -6px rgba(0, 0, 0, 0.45);`) and `.celestial-slider` (`accent-color: var(--color-accent); height: 0.375rem; border-radius: 9999px; background-color: #1e293b; cursor: pointer;`).

In `src/components/layout/side-tab.tsx`:
- Remove the duplicate `<div className="md:hidden sticky top-0 ...">` block.
- Change the mobile drawer top offset from `top-14` to `top-12` (`isMobileOpen && '!flex fixed left-0 top-12 bottom-0 w-64 shadow-2xl z-50'`) so it docks cleanly beneath the `h-12` `TopBar`.
- Add per-tool subtle icon color classes (`text-rose-400`, `text-purple-400`, `text-amber-400`, `text-sky-400`, `text-emerald-400`) on active/hover states and update active link border from `border-slate-300` to `border-amber-400 bg-surface-elevated/90 shadow-xs`.

In `src/components/layout/top-bar.tsx`:
- On mobile (`md:hidden`), display the compact Bastelina brand avatar link before the divider so mobile users see brand + breadcrumb + menu toggle in a single `h-12` sticky header bar.

- [ ] **Step 4: Run tests to verify Task 1 passes**

Run: `node --test tests/celestial-nav-and-tokens.test.mjs && node tests/tokens-and-layout.test.mjs && node tests/navigation-structure.test.mjs`
Expected: PASS

---

### Task 2: Home Page Polish (`page.tsx`, `tools-grid.tsx`, `trekker-spotlight.tsx`, `reset-timer.tsx`, `changelog.tsx`)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/home/tools-grid.tsx`
- Modify: `src/components/home/trekker-spotlight.tsx`
- Modify: `src/components/home/reset-timer.tsx`
- Modify: `src/components/home/changelog.tsx`
- Create: `tests/home-polish.test.mjs`

**Interfaces:**
- Consumes `.celestial-card` from `src/app/globals.css`.
- Preserves the exact top-to-bottom section order in `src/app/page.tsx` (`Header` → `Tools & Calculators` → `Trekker of the Day & Reset Time Information` → `Changelog`).

- [ ] **Step 1: Write the failing test in `tests/home-polish.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ToolsGrid spans the 5th card across 2 columns on md screens and uses celestial-card', () => {
  const grid = fs.readFileSync('src/components/home/tools-grid.tsx', 'utf8');
  assert.ok(grid.includes('md:col-span-2'), '5th tool card must span 2 columns on desktop');
  assert.ok(grid.includes('celestial-card'), 'Tool cards must use celestial-card surface class');
  assert.ok(!grid.includes('bg-gradient-to-b'), 'Must not use bg-gradient-to-b');
});

test('TrekkerSpotlight shows minimal role and element badges and matches heading hierarchy', () => {
  const spotlight = fs.readFileSync('src/components/home/trekker-spotlight.tsx', 'utf8');
  const resetTimer = fs.readFileSync('src/components/home/reset-timer.tsx', 'utf8');
  const home = fs.readFileSync('src/app/page.tsx', 'utf8');

  assert.ok(spotlight.includes('featured.class'), 'TrekkerSpotlight must display character role/class badge');
  assert.ok(spotlight.includes('featured.element'), 'TrekkerSpotlight must display character element badge');
  assert.ok(spotlight.includes('text-lg sm:text-xl'), 'TrekkerSpotlight heading must use unified text-lg sm:text-xl');
  assert.ok(resetTimer.includes('text-lg sm:text-xl'), 'ResetTimer heading must use unified text-lg sm:text-xl');
  assert.ok(home.includes('text-lg sm:text-xl'), 'Home Tools section heading must use unified text-lg sm:text-xl');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/home-polish.test.mjs`
Expected: FAIL (`5th tool card must span 2 columns on desktop`)

- [ ] **Step 3: Update Home page components**

- In `src/app/page.tsx`:
  - Standardize the "Tools & Calculators" `<h2>` to `text-lg sm:text-xl font-bold tracking-tight text-white`.
  - Style external data attribution links in the header as sleek pill badges (`bg-surface-card border border-border-subtle hover:border-border-hover px-2.5 py-1 rounded-md`).
- In `src/components/home/tools-grid.tsx`:
  - Apply `celestial-card` to each card container and add `index === tools.length - 1 ? 'md:col-span-2' : ''` on the `<Link>` wrapper so **Trekker Encyclopedia** spans the full row cleanly on `md+` screens.
- In `src/components/home/trekker-spotlight.tsx`:
  - Unify section `<h2>` to `text-lg sm:text-xl font-bold tracking-tight text-white`.
  - Apply `celestial-card` to the card container and display minimal Element (`featured.element`) and Role (`featured.class`) pills beneath the Trekker's name and star badge (no extra action buttons).
- In `src/components/home/reset-timer.tsx` and `src/components/home/changelog.tsx`:
  - Unify `Reset Time Information` `<h2>` to `text-lg sm:text-xl font-bold tracking-tight text-white` and apply `celestial-card` to the card containers.

- [ ] **Step 4: Run tests to verify Task 2 passes**

Run: `node --test tests/home-polish.test.mjs && node tests/final-design-audit.test.mjs`
Expected: PASS

---

### Task 3: Calculators & TrekkerSelector Harmonization (`trekker-selector.tsx`, `level-stepper.tsx`, `bond/page.tsx`, `calculator/page.tsx`)

**Files:**
- Modify: `src/components/calculator/trekker-selector.tsx`
- Modify: `src/components/calculator/level-stepper.tsx`
- Modify: `src/app/bond/page.tsx`
- Modify: `src/app/calculator/page.tsx`
- Create: `tests/calculators-unification.test.mjs`

**Interfaces:**
- `TrekkerSelector({ selectedId, onSelect, title, subtitle }: TrekkerSelectorProps)`: renders `{subtitle || 'Calculate ascension breakthrough and skill investment requirements.'}` and uses `from-[#c084fc] via-[#818cf8] to-[#38bdf8]` for 5★ top/bottom bars.
- `BondPage` (`src/app/bond/page.tsx`): passes `subtitle="Select a Trekker to view their favorite Heartlink gifts and calculate exact Affinity EXP milestones."` to `<TrekkerSelector />`, uses `.celestial-slider` and `- / +` stepper buttons (`aria-label="Decrease current level"`, `aria-label="Increase current level"`, `aria-label="Decrease target level"`, `aria-label="Increase target level"`).

- [ ] **Step 1: Write the failing test in `tests/calculators-unification.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('TrekkerSelector renders subtitle prop and uses prismatic 5-star gradient', () => {
  const selector = fs.readFileSync('src/components/calculator/trekker-selector.tsx', 'utf8');
  assert.ok(selector.includes('{subtitle ||'), 'TrekkerSelector must render its subtitle prop');
  assert.ok(selector.includes('from-[#c084fc]'), 'TrekkerSelector 5-star card must match prismatic gradient');
});

test('Bond calculator passes custom subtitle and uses celestial-slider with level steppers', () => {
  const bond = fs.readFileSync('src/app/bond/page.tsx', 'utf8');
  assert.ok(bond.includes('subtitle='), 'Bond page must pass a custom subtitle to TrekkerSelector');
  assert.ok(bond.includes('celestial-slider'), 'Bond level sliders must use celestial-slider class');
  assert.ok(bond.includes('aria-label="Decrease current level"'), 'Bond must include current level stepper buttons');
  assert.ok(bond.includes('aria-label="Increase target level"'), 'Bond must include target level stepper buttons');
});

test('LevelStepper uses compact desktop stepper buttons instead of oversized size-11 on sm+', () => {
  const stepper = fs.readFileSync('src/components/calculator/level-stepper.tsx', 'utf8');
  assert.ok(!stepper.includes('size-11 sm:size-11'), 'LevelStepper must not force 44px buttons on desktop');
  assert.ok(stepper.includes('celestial-slider'), 'LevelStepper must use celestial-slider class');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/calculators-unification.test.mjs`
Expected: FAIL (`TrekkerSelector must render its subtitle prop`)

- [ ] **Step 3: Update `TrekkerSelector`, `LevelStepper`, `bond/page.tsx`, and `calculator/page.tsx`**

- In `src/components/calculator/trekker-selector.tsx`:
  - Render `{subtitle || 'Calculate ascension breakthrough and skill investment requirements.'}` inside the description `<p>`.
  - Update 5★ border and top/bottom accent bars to match `TrekkerCard` (`border-purple-400/60 shadow-lg shadow-purple-950/20` and `bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]`).
  - Apply `celestial-card` to the outer showcase card.
- In `src/components/calculator/level-stepper.tsx`:
  - Replace `size-11 sm:size-11` on the 4 `- / +` buttons with `size-8 sm:size-7` so they remain touch-friendly on mobile and compact on desktop.
  - Apply `celestial-card` to the outer container and `celestial-slider` to both `<input type="range">` elements.
- In `src/app/bond/page.tsx`:
  - Pass `subtitle="Select a Trekker to view their favorite Heartlink gifts and calculate exact Affinity EXP milestones."` to `<TrekkerSelector />`.
  - Add compact `- / +` stepper buttons (`Minus` and `Plus` from `lucide-react`) alongside `Current Level` and `Target Level` in the **Heartlink Milestone** card, clamping `currentLevel` to `1..98` (bumping `targetLevel` when needed) and `targetLevel` to `(currentLevel + 1)..99`.
  - Replace `accent-slate-400` on both range sliders with `celestial-slider` and highlight active Quick Milestone buttons with amber (`bg-amber-500 border-amber-600 text-slate-950 font-bold`).
  - Apply `celestial-card` to the Milestone, Progress, and Gift Allocation cards.
- In `src/app/calculator/page.tsx`:
  - Standardize the outer container and header spacing (`py-6`, `text-2xl sm:text-3xl font-bold tracking-tight text-white`, `border-b border-border-subtle pb-5`) to match `bond/page.tsx`.

- [ ] **Step 4: Run tests to verify Task 3 passes**

Run: `node --test tests/calculators-unification.test.mjs && node tests/selector-and-stepper.test.mjs && node tests/bond-calculator.test.mjs && node --test tests/ui-accessibility.test.mjs`
Expected: PASS

---

### Task 4: Preset Visualizer, Roadmap, Encyclopedia & Credits Token Alignment (`builder/page.tsx`, `roadmap/page.tsx`, `trekkers/page.tsx`, `credits/page.tsx`)

**Files:**
- Modify: `src/app/builder/page.tsx`
- Modify: `src/components/builder/build-card-export.tsx`
- Modify: `src/app/roadmap/page.tsx`
- Modify: `src/app/trekkers/page.tsx`
- Modify: `src/app/credits/page.tsx`
- Create: `tests/pages-celestial-polish.test.mjs`

**Interfaces:**
- Consumes `.celestial-card` and CSS token classes (`bg-surface-card`, `border-border-subtle`, `hover:border-border-hover`) across remaining pages while keeping all layouts and behaviors unchanged.

- [ ] **Step 1: Write the failing test in `tests/pages-celestial-polish.test.mjs`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Builder, Roadmap, Trekkers, and Credits use celestial-card and semantic border tokens', () => {
  const builder = fs.readFileSync('src/app/builder/page.tsx', 'utf8');
  const roadmap = fs.readFileSync('src/app/roadmap/page.tsx', 'utf8');
  const trekkers = fs.readFileSync('src/app/trekkers/page.tsx', 'utf8');
  const credits = fs.readFileSync('src/app/credits/page.tsx', 'utf8');

  assert.ok(!builder.includes('border-[#23293a]'), 'Builder buttons must use semantic border tokens instead of raw hex');
  assert.ok(!roadmap.includes('border-[#1a202c]'), 'Roadmap header and pills must use semantic border tokens instead of raw hex');
  assert.ok(trekkers.includes('celestial-card'), 'Trekkers filter bar must use celestial-card');
  assert.ok(credits.includes('celestial-card'), 'Credits panels must use celestial-card');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/pages-celestial-polish.test.mjs`
Expected: FAIL (`Builder buttons must use semantic border tokens instead of raw hex`)

- [ ] **Step 3: Apply Celestial Dark tokens across `builder`, `roadmap`, `trekkers`, and `credits`**

- In `src/app/builder/page.tsx`:
  - Replace hardcoded `border-[#23293a] bg-[#131720] hover:bg-[#1a1f2c]` on the `Change Trekker` and `Choose Potentials` buttons with `celestial-card hover:bg-surface-elevated hover:border-border-hover` (without introducing `bg-gradient-to-r`).
- In `src/components/builder/build-card-export.tsx`:
  - Keep `#0c1427` on `#team-card-export` for PNG rasterization fidelity, and apply `celestial-card` to the action bar window below it.
- In `src/app/roadmap/page.tsx`:
  - Replace hardcoded `border-[#1a202c]` and `bg-[#11141c]` in the page header and status pills with `border-border-subtle` and `celestial-card`.
- In `src/app/trekkers/page.tsx` and `src/app/credits/page.tsx`:
  - Apply `celestial-card` to the search/filter bar and credits attribution cards.

- [ ] **Step 4: Run the full verification suite**

Run: `node --test tests/pages-celestial-polish.test.mjs && node --test tests/ui-transitions.test.mjs && node tests/builder-layout.test.mjs && node tests/trekker-cards.test.mjs && node tests/final-design-audit.test.mjs`
Expected: PASS
