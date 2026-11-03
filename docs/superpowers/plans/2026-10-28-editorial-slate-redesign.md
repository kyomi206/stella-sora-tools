# Editorial Slate & Minimal Craft Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the visual styling, typography rhythm, and micro-interactions of Stella Sora Tools into a calm, minimalist editorial companion while strictly freezing the Team Builder squad layout and canvas export preview.

**Architecture:** Update global design tokens and utility classes in `src/app/globals.css` with a refined slate hierarchy, then systematically restyle the layout shell, Home dashboard, Trekker Encyclopedia, Calculators, and Roadmap. Apply high-leverage Kowalski micro-interactions (tactile `:active` feedback and modal entrance transitions) with full reduced-motion support.

**Tech Stack:** Next.js 16.4.3 (App Router), React 19.3.0, Tailwind CSS v4, Lucide React, Node.js test scripts.

**Spec:** [`docs/superpowers/specs/2026-10-28-editorial-slate-redesign-design.md`](file:///D:/Stuff/Projects/sstt/blank/docs/superpowers/specs/2026-10-28-editorial-slate-redesign-design.md)

## Global Constraints
- **Team Builder Freeze**: The layout of `/builder`, its 3-seat squad setup (Vanguard, Versatile, Support), potentials selector, and `BuildCardExport` canvas preview must remain functional and visually stable.
- **Color Discipline**: Neutral chrome must not use amber accents. Vibrant color is strictly reserved for in-game data (6 elements: Ignis, Aqua, Terra, Ventus, Umbra, Lux; rarity tiers: 5★ Purple, 4★ Gold, 3★ Blue).
- **No Gratuitous Animation**: Fast UI interactions must remain instantaneous (filtering, step inputs, ticking clocks); motion is restricted to modal dialog entry (`<200ms`), press feedback (`120ms`), and mobile drawer slide-up.
- **Backward Compatibility**: Preserve existing token definitions in `globals.css` (`--color-base`, `--color-surface`, `--color-border`, `--color-accent`) to maintain regression test compatibility.
- **Production Build Integrity**: `npm run build` must succeed with zero TypeScript or linting errors.

## Review Focus
1. **Modal Entrance Smoothness**: Opening character/potential pickers must enter with `zoom-in-95 fade-in duration-180` without jumpy scroll locks or clipping.
2. **Reduced Motion Compliance**: When `prefers-reduced-motion` is enabled, all transitions and animations must collapse to zero duration.
3. **Sidebar Collapse Stability**: Collapsing the sidebar on desktop must smoothly animate width without causing text label wrap jitter before hiding.
4. **Card Export Stability**: Generating squad card images via `BuildCardExport` (`html2canvas-pro`) must render without color shifts, clipped borders, or font size regressions.
5. **Elemental Filter Authenticity**: Filtering by element in the encyclopedia must highlight active pills with the authentic element hue rather than generic amber.

---

### Task 1: Global Theme Tokens, Motion Utilities & Core Regression Tests

**Files:**
- Modify: `src/app/globals.css:1-20`
- Test: `tests/tokens-and-layout.test.mjs`

**Interfaces:**
- Produces: CSS custom properties (`--color-base`, `--color-surface`, `--color-surface-hover`, `--color-border`, `--color-border-subtle`, `--color-accent`), `.press-feedback` utility class, and `@media (prefers-reduced-motion: reduce)` rule.

- [ ] **Step 1: Inspect and update test assertion if needed**
Verify `tests/tokens-and-layout.test.mjs` to ensure required token checks are preserved.

- [ ] **Step 2: Run current token test to establish passing baseline**
Run: `node tests/tokens-and-layout.test.mjs`
Expected: PASS ("✓ Task 1 token and typography checks passed")

- [ ] **Step 3: Update `src/app/globals.css` with refined tokens and micro-interaction utilities**
Add slate surface hierarchy tokens (`#0a0c10` / `#0c0e12`, `#11141c`, `#161b26`, `#1a202c`, `#141822`), `.press-feedback` active state, and reduced-motion reset:
```css
@import "tailwindcss";

:root {
  --color-base: #0c0e12;
  --color-surface: #11141c;
  --color-surface-hover: #161b26;
  --color-border: #1a202c;
  --color-border-subtle: #141822;
  --color-accent: #f59e0b;
}

@theme inline {
  --color-surface: #11141c;
  --color-surface-hover: #161b26;
  --color-border: #1a202c;
  --color-accent: #f59e0b;
  --font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: var(--font-geist-mono), monospace;
}

body {
  background-color: var(--color-base);
  color: #f1f5f9;
  font-family: var(--font-sans);
}

@media (hover: hover) and (pointer: fine) {
  .press-feedback:active {
    transform: scale(0.98);
    transition: transform 120ms ease-out;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Verify token test passes with updated CSS**
Run: `node tests/tokens-and-layout.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit Task 1**
```bash
git add src/app/globals.css
git commit -m "style: refine dark slate tokens and add press-feedback motion utility"
```

---

### Task 2: Layout Shell & Navigation Refinement

**Files:**
- Modify: `src/components/layout/side-tab.tsx:100-240`
- Modify: `src/components/layout/footer.tsx:1-40`
- Modify: `src/app/layout.tsx:30-47`
- Test: `tests/navigation-structure.test.mjs`

**Interfaces:**
- Consumes: `.press-feedback` and slate color tokens from `globals.css`.
- Produces: Polished responsive navigation bar and desktop sidebar with zero text wrapping jitter during collapse.

- [ ] **Step 1: Run baseline navigation test**
Run: `node tests/navigation-structure.test.mjs`
Expected: PASS

- [ ] **Step 2: Restyle `src/components/layout/side-tab.tsx`**
- Replace bright amber badge in brand logo with a clean slate/silver monogram or icon container (`bg-slate-800/40 border border-slate-700/40 text-slate-200`).
- Refactor active nav link styling from amber glow to subtle flat slate background (`bg-[#181e2b] text-white border-l-2 border-slate-300 font-medium`).
- Fix collapse text wrap jitter: apply `transition: width 200ms cubic-bezier(0.2, 0, 0, 1)` and cleanly fade text using `opacity 120ms ease-out` when collapsed.
- Add `.press-feedback` to navigation buttons and links.

- [ ] **Step 3: Refine `src/components/layout/footer.tsx`**
- Use clean slate typography (`text-xs text-slate-500`) with subtle border `border-[#1a202c]`.
- Remove distracting badges; maintain clean links to Wiki and Datamine repository.

- [ ] **Step 4: Verify navigation test passes**
Run: `node tests/navigation-structure.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```bash
git add src/components/layout/side-tab.tsx src/components/layout/footer.tsx src/app/layout.tsx
git commit -m "style: overhaul navigation rail into minimal slate aesthetic"
```

---

### Task 3: Home Dashboard Editorial Overhaul

**Files:**
- Modify: `src/app/page.tsx:1-74`
- Modify: `src/components/home/tools-grid.tsx:1-94`
- Modify: `src/components/home/reset-timer.tsx:1-60`
- Modify: `src/components/home/trekker-spotlight.tsx:1-80`
- Modify: `src/components/home/changelog.tsx:1-60`
- Test: `tests/final-design-audit.test.mjs`

**Interfaces:**
- Consumes: Editorial slate tokens and `.press-feedback`.
- Produces: High-density, minimal home dashboard without marketing hero bloat.

- [ ] **Step 1: Refactor `src/app/page.tsx` header**
- Remove the 250px marketing banner and uppercase sparkle badge (`<Sparkles /> Tyrant's Toolkit • Stella Sora`).
- Render a concise, confident title block:
  ```tsx
  <section className="flex flex-col gap-2 pb-5 border-b border-[#1a202c]">
    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
      Stella Sora Tools
    </h1>
    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
      A minimal web companion for Stella Sora. Squad builder with potentials, heartlink affinity optimizer, and datamined event timelines.
    </p>
    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
      <a href="https://github.com/Hiro420/StellaSoraData" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Data Repo</a>
      <span>•</span>
      <a href="https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Miraheze Wiki</a>
    </div>
  </section>
  ```

- [ ] **Step 2: Redesign `src/components/home/tools-grid.tsx`**
- Strip the "icon-in-a-box" containers (`size-10 rounded-lg bg-[#0c0e12] border border-[#23293a] text-amber-400`).
- Convert each tool into a clean editorial card:
  - Container: `p-5 rounded-xl border border-[#1a202c] bg-[#11141c] hover:border-[#2b3548] transition-all duration-150 press-feedback`.
  - Header: Inline title with sleek icon in muted slate (`text-slate-300 size-4.5`) and title in `text-white font-semibold group-hover:text-slate-100`.
  - Body: 2-line summary in `text-xs text-slate-400 leading-relaxed`.
  - Footer: Subtle chevron arrow link (`text-xs text-slate-500 group-hover:text-slate-300`).

- [ ] **Step 3: Refine `reset-timer.tsx` and `trekker-spotlight.tsx`**
- `reset-timer.tsx`: Clean slate card, tabular figures for clock (`tabular-nums font-mono text-xl text-white`), clean progress bar without loud amber glows.
- `trekker-spotlight.tsx`: Clean slate card with Trekker avatar, authentic elemental badge, and compact gift affinity tag.
- `changelog.tsx`: Minimalist border and quiet release history list.

- [ ] **Step 4: Verify home page design audit test passes**
Run: `node tests/final-design-audit.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit Task 3**
```bash
git add src/app/page.tsx src/components/home/
git commit -m "style: overhaul home dashboard with compact editorial cards"
```

---

### Task 4: Trekker Encyclopedia Refinement

**Files:**
- Modify: `src/app/trekkers/page.tsx:1-273`
- Test: `tests/trekker-cards.test.mjs`

**Interfaces:**
- Consumes: Elemental tokens and card structure conventions.
- Produces: Streamlined character directory with authentic elemental filter pills and clean card frames.

- [ ] **Step 1: Run baseline trekker cards test**
Run: `node tests/trekker-cards.test.mjs`
Expected: PASS ("✓ Trekker card & portrait checks passed")

- [ ] **Step 2: Refactor filter bar and search input in `src/app/trekkers/page.tsx`**
- Replace the bulky filter container with clean inline filter pills.
- Search input: Minimal recessed bar (`bg-[#0c0f15] border border-[#1a202c] focus:border-slate-500 text-slate-100 placeholder:text-slate-500`).
- Element filter pills:
  - Map active element filter to authentic elemental hue:
    - Ignis: `bg-rose-500/15 text-rose-300 border-rose-500/40`
    - Aqua: `bg-sky-500/15 text-sky-300 border-sky-500/40`
    - Terra: `bg-amber-500/15 text-amber-300 border-amber-500/40`
    - Ventus: `bg-emerald-500/15 text-emerald-300 border-emerald-500/40`
    - Umbra: `bg-purple-500/15 text-purple-300 border-purple-500/40`
    - Lux: `bg-yellow-500/15 text-yellow-300 border-yellow-500/40`
  - Inactive pills: `bg-[#11141c] text-slate-400 border-[#1a202c] hover:text-slate-200 hover:border-slate-700`.

- [ ] **Step 3: Refine character cards in `trekkers/page.tsx`**
- Retain the official role banner (`clip-path:polygon`) and rarity gradient (`from-[#c084fc]`) to satisfy test assertions and in-game aesthetic.
- Update outer card border to `border-[#1a202c] hover:border-[#2b3548]` with `bg-[#11141c]`.
- Add `.press-feedback` on card click target.

- [ ] **Step 4: Verify trekker cards test passes**
Run: `node tests/trekker-cards.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit Task 4**
```bash
git add src/app/trekkers/page.tsx
git commit -m "style: refine trekker encyclopedia filter bar and elemental pills"
```

---

### Task 5: Calculators & Roadmap Minimal Polish

**Files:**
- Modify: `src/app/bond/page.tsx:35-150`
- Modify: `src/app/calculator/page.tsx:1-120`
- Modify: `src/app/roadmap/page.tsx:1-81`
- Modify: `src/components/roadmap/roadmap-timeline.tsx`
- Test: `tests/bond-calculator.test.mjs`
- Test: `tests/calculator-integration.test.mjs`
- Test: `tests/roadmap-data.test.mjs`

**Interfaces:**
- Consumes: `.press-feedback` utility and slate panel tokens.
- Produces: Polished calculator tables, smooth mobile drawers, and streamlined roadmap timeline.

- [ ] **Step 1: Run baseline calculator and roadmap tests**
Run: `node tests/bond-calculator.test.mjs`
Run: `node tests/calculator-integration.test.mjs`
Run: `node tests/roadmap-data.test.mjs`
Expected: All 3 PASS

- [ ] **Step 2: Polish `src/app/bond/page.tsx`**
- Keep gift card rarity indicators (Exquisite Purple, Rare Yellow, Common Blue) with softened background tints (`bg-purple-950/15`, `bg-amber-950/15`, `bg-sky-950/15`) and clean 1px borders.
- Add `.press-feedback` to quick-fill buttons and level step controls.
- Clean header: Remove uppercase sparkle tags.

- [ ] **Step 3: Polish `src/app/calculator/page.tsx`**
- Add `.press-feedback` to level and skill steppers.
- Add slide-up transition to mobile materials drawer:
  ```tsx
  className={cn(
    "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-[#1a202c] bg-[#0e1117] p-5 shadow-2xl transition-transform duration-220 ease-out",
    isMobileDrawerOpen ? "translate-y-0" : "translate-y-full"
  )}
  ```

- [ ] **Step 4: Polish `src/app/roadmap/page.tsx`**
- Replace `font-mono` on banner count pills with clean sans text.
- Clean header description and ensure today highlight line stands out against `#0c0e12` slate grid.

- [ ] **Step 5: Verify tests pass**
Run: `node tests/bond-calculator.test.mjs`
Run: `node tests/calculator-integration.test.mjs`
Run: `node tests/roadmap-data.test.mjs`
Expected: All 3 PASS

- [ ] **Step 6: Commit Task 5**
```bash
git add src/app/bond/page.tsx src/app/calculator/page.tsx src/app/roadmap/page.tsx src/components/roadmap/
git commit -m "style: refine calculators and roadmap timeline styling"
```

---

### Task 6: Picker Modals Motion & Team Builder Freeze Verification

**Files:**
- Modify: `src/components/builder/trekker-picker-modal.tsx:90-110`
- Modify: `src/components/builder/potentials-picker-modal.tsx:90-110`
- Verify (unmodified): `src/app/builder/page.tsx`
- Verify (unmodified): `src/components/builder/build-card-export.tsx`
- Test: `tests/builder-layout.test.mjs`
- Test: Full build `npm run build`

**Interfaces:**
- Consumes: Kowalski modal scale entrance animation.
- Produces: Smooth modal dialog entries while maintaining 100% frozen state of the squad builder and canvas export card.

- [ ] **Step 1: Run builder layout test baseline**
Run: `node tests/builder-layout.test.mjs`
Expected: PASS

- [ ] **Step 2: Add modal entrance animation wrapper to `trekker-picker-modal.tsx`**
In `src/components/builder/trekker-picker-modal.tsx`, update the modal dialog container:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="trekker-picker-modal-title"
  className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
  onClick={onClose}
>
  <div
    className="relative w-full max-w-4xl max-h-[88vh] rounded-2xl border border-[#1a202c] bg-[#0e1117] text-slate-100 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-180 ease-out"
    onClick={(e) => e.stopPropagation()}
  >
```

- [ ] **Step 3: Add modal entrance animation wrapper to `potentials-picker-modal.tsx`**
Similarly update the dialog container in `src/components/builder/potentials-picker-modal.tsx` with `animate-in fade-in zoom-in-95 duration-180 ease-out`.

- [ ] **Step 4: Confirm `/builder` and `BuildCardExport` remain completely untouched**
Run git diff check:
Run: `git diff src/app/builder/page.tsx src/components/builder/build-card-export.tsx`
Expected: No diff output (files are completely untouched).

- [ ] **Step 5: Run builder layout test**
Run: `node tests/builder-layout.test.mjs`
Expected: PASS

- [ ] **Step 6: Run full production build**
Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 7: Commit Task 6**
```bash
git add src/components/builder/trekker-picker-modal.tsx src/components/builder/potentials-picker-modal.tsx
git commit -m "feat(motion): add smooth modal entrance animation while preserving builder freeze"
```
