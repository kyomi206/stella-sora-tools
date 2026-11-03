# Hallmark & Web Interface Guidelines Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all UI/UX defects, accessibility barriers, Hallmark floor violations (purple-to-blue gradients, raw hex literals, tracked-caps labels, template middle dots, width animations), and Web Interface Guidelines issues across `blank` while ensuring 100% build health and test suite stability.

**Architecture:**
1. CSS & Token Foundation: Lift raw colors into `@theme inline` in `globals.css`, add dark color-scheme, tap highlight, touch action, and Hallmark stamp.
2. Accessibility & Focus Hardening: Replace `focus:outline-none` with visible focus rings, add accessible `aria-label` to icon-only links/buttons/inputs, ensure keyboard handlers on interactive elements, and add `overscroll-behavior: contain` on modals.
3. Animation & Layout Performance: Remove `transition-[width]`, replace progress bar width transitions with hardware-accelerated transforms, fix sticky header collision in `/calculator`.
4. Typography & Punctuation: Clean up template dots `•`, replace `...` with typographic `…`, and eliminate tracked uppercase labels and eyebrows.
5. Verification: Verify via sloplint, all unit tests (`tests/*.test.mjs`), and `npm run build`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript 5, Node.js Test Runner.

---

### Task 1: CSS Foundation & Design Token Modernization

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Test: `tests/tokens-and-layout.test.mjs`, `tests/ui-foundation.test.mjs`

- [ ] **Step 1: Update `globals.css` with Hallmark stamp, `color-scheme: dark`, touch settings, and semantic color tokens (`--color-surface-card`, `--color-surface-subtle`, `--color-surface-elevated`, `--color-border-subtle`, `--color-border-hover`, `--color-text`, `--color-text-muted`)**
- [ ] **Step 2: Update `layout.tsx` to use design tokens, add `themeColor` in metadata, and fix focus outline on skip-link and main**
- [ ] **Step 3: Run `node --test tests/tokens-and-layout.test.mjs tests/ui-foundation.test.mjs`**

---

### Task 2: Core Navigation, Sidebar & TopBar Accessibility

**Files:**
- Modify: `src/components/layout/side-tab.tsx`
- Modify: `src/components/layout/top-bar.tsx`
- Modify: `src/components/layout/footer.tsx`
- Test: `tests/navigation-structure.test.mjs`, `tests/ui-accessibility.test.mjs`

- [ ] **Step 1: Update `side-tab.tsx` to remove `transition-[width]`, add `aria-label` for collapsed state icon links, add `aria-expanded={isMobileOpen}`, and add dimensions to bastelina icon**
- [ ] **Step 2: Update `top-bar.tsx` to make tooltip bubble visible on keyboard focus (`group-focus-visible:opacity-100`), add dynamic `aria-expanded={!isCollapsed}`, mark icons `aria-hidden="true"`**
- [ ] **Step 3: Update `footer.tsx` to remove template middle dots `•`, remove em dash, and use theme tokens**
- [ ] **Step 4: Run `node --test tests/navigation-structure.test.mjs`**

---

### Task 3: Home Dashboard Polish (`/` page & components)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/home/tools-grid.tsx`
- Modify: `src/components/home/trekker-spotlight.tsx`
- Modify: `src/components/home/reset-timer.tsx`
- Modify: `src/components/home/changelog.tsx`
- Test: `tests/final-design-audit.test.mjs`

- [ ] **Step 1: In `page.tsx`, remove middle-dot template separators `•` and replace hex literals with tokens**
- [ ] **Step 2: In `tools-grid.tsx`, fix double-space typo, replace `,...` with `…`, add `aria-hidden="true"` to icons, and use token classes**
- [ ] **Step 3: In `trekker-spotlight.tsx`, add explicit `width` and `height` to images, fix `py-0.2`, and use token classes**
- [ ] **Step 4: In `reset-timer.tsx`, add `suppressHydrationWarning` to countdown to prevent hydration mismatch, use token classes**
- [ ] **Step 5: In `changelog.tsx`, remove em dashes, add `aria-hidden="true"` to decorative icons, use token classes**
- [ ] **Step 6: Run `node --test tests/final-design-audit.test.mjs`**

---

### Task 4: Bond & Affinity Calculator Remediation (`/bond`)

**Files:**
- Modify: `src/app/bond/page.tsx`
- Test: `tests/bond-calculator.test.mjs`, `tests/gifts-integration.test.mjs`, `tests/ui-accessibility.test.mjs`

- [ ] **Step 1: Replace layout width transition on progress bar (`transition-[width]`) with scaleX transform or stable animation**
- [ ] **Step 2: Add `aria-label` to range inputs (Current Level, Target Level)**
- [ ] **Step 3: Ensure stepper buttons include both literal `aria-label="Decrease"` and `aria-label="Increase"` (and full gift count label) to satisfy accessibility test**
- [ ] **Step 4: Ensure `Auto-Fill Favorites`, `Favorite Gifts:`, `Trekker Preference:`, and Empty (`Trash2`) button are intact to satisfy integration tests**
- [ ] **Step 5: Replace `focus:outline-none` with `focus-visible:ring-2 focus-visible:ring-amber-500/50`**
- [ ] **Step 6: Replace loading `...` with `…` and remove tracked uppercase labels**
- [ ] **Step 7: Run `node --test tests/bond-calculator.test.mjs tests/gifts-integration.test.mjs tests/ui-accessibility.test.mjs`**

---

### Task 5: Resource Calculator Remediation (`/calculator`)

**Files:**
- Modify: `src/app/calculator/page.tsx`
- Modify: `src/components/calculator/trekker-selector.tsx`
- Modify: `src/components/calculator/level-stepper.tsx`
- Modify: `src/components/calculator/skills-matrix.tsx`
- Modify: `src/components/calculator/materials-bill.tsx`
- Test: `tests/calculator-integration.test.mjs`, `tests/materials-bill.test.mjs`, `tests/selector-and-stepper.test.mjs`, `tests/skills-matrix.test.mjs`

- [ ] **Step 1: Fix sticky collision in `calculator/page.tsx` from `lg:top-3` to `lg:top-14` (below the 48px sticky header)**
- [ ] **Step 2: Add `overscroll-contain` to mobile bill drawer**
- [ ] **Step 3: In `trekker-selector.tsx`, replace purple-to-blue gradient `from-[#c084fc] via-[#818cf8] to-[#38bdf8]` with solid gold/amber, remove image hover scaling `group-hover:scale-105`, add image dimensions**
- [ ] **Step 4: In `level-stepper.tsx`, `skills-matrix.tsx`, `materials-bill.tsx`, normalize tracked uppercase labels, mark decorative icons `aria-hidden="true"`, add image dimensions**
- [ ] **Step 5: Run `node --test tests/calculator-integration.test.mjs tests/materials-bill.test.mjs tests/selector-and-stepper.test.mjs tests/skills-matrix.test.mjs`**

---

### Task 6: Squad Builder & Trekker Cards Remediation (`/builder`)

**Files:**
- Modify: `src/app/builder/page.tsx`
- Modify: `src/components/builder/trekker-card.tsx`
- Modify: `src/components/builder/trekker-picker-modal.tsx`
- Modify: `src/components/builder/potentials-picker-modal.tsx`
- Modify: `src/components/builder/build-card-export.tsx`
- Test: `tests/builder-layout.test.mjs`, `tests/trekker-cards.test.mjs`, `tests/modal-animation.test.mjs`

- [ ] **Step 1: In `builder/page.tsx`, replace `window.confirm` with non-blocking confirmation dialog or inline confirm, add `aria-label="Squad build name"`, fix placeholder `...` to `…`**
- [ ] **Step 2: In `trekker-card.tsx` and `build-card-export.tsx`, replace purple-to-blue gradient with solid amber/gold, ensure keyboard handlers and focus ring on seat slots, remove image hover zoom**
- [ ] **Step 3: In `trekker-picker-modal.tsx` and `potentials-picker-modal.tsx`, add `overscroll-contain`, add `aria-live="polite"` on quota error banner, normalize tracked uppercase labels**
- [ ] **Step 4: Run `node --test tests/builder-layout.test.mjs tests/trekker-cards.test.mjs tests/modal-animation.test.mjs`**

---

### Task 7: Events Roadmap & Trekker Encyclopedia Polish (`/roadmap` & `/trekkers`)

**Files:**
- Modify: `src/app/roadmap/page.tsx`
- Modify: `src/components/roadmap/roadmap-timeline.tsx`
- Modify: `src/components/roadmap/roadmap-item-details.tsx`
- Modify: `src/components/roadmap/unreleased-trekkers-bar.tsx`
- Modify: `src/app/trekkers/page.tsx`
- Modify: `src/app/credits/page.tsx`
- Test: `tests/roadmap-data.test.mjs`

- [ ] **Step 1: In `roadmap-timeline.tsx`, remove decorative status dots before category pills, add `aria-label="Search events"` on search input, fix `focus:outline-none`, replace `...` with `…`, add `aria-label` to zoom buttons**
- [ ] **Step 2: In `roadmap-item-details.tsx`, add `overscroll-contain`, normalize uppercase labels, remove `font-mono` on non-numeric strings, remove image hover zoom**
- [ ] **Step 3: In `trekkers/page.tsx`, replace purple-to-blue gradient with solid amber/gold, add `aria-label` on search input, fix `focus:outline-none`, replace `...` with `…`, remove image hover zoom**
- [ ] **Step 4: In `credits/page.tsx`, mark tech SVGs `aria-hidden="true"`, remove uppercase tracked eyebrow before `<h1>`, remove em dash**
- [ ] **Step 5: Run `node --test tests/roadmap-data.test.mjs`**

---

### Task 8: Final Sweep, Verification & Build Confirmation

- [ ] **Step 1: Run sloplint check: `node ../hallmark/scripts/sloplint.mjs src --scope app`**
- [ ] **Step 2: Run all unit tests: `node --test tests/*.test.mjs`**
- [ ] **Step 3: Run production build: `npm run build`**
