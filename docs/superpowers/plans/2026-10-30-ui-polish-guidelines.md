# UI Polish, Accessibility & Web Interface Guidelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all UI/UX, accessibility, animation performance, typography, and focus state issues identified in the audit according to Vercel Web Interface Guidelines and Hallmark standards without altering core app logic.

**Architecture:** 
1. Global CSS & Layout hardening: inject global `:focus-visible` ring defaults, `prefers-reduced-motion` safety, and a skip-to-content anchor in `src/app/layout.tsx`.
2. Replace all 23 instances of `transition-all` with explicit property transitions (`transition-colors`, `transition-transform`, etc.).
3. Semantic HTML & ARIA remediation: convert interactive `div` elements to `button`, add missing `aria-label` to icon buttons, and mark decorative Lucide icons with `aria-hidden="true"`.
4. Modal containment: add `overscroll-contain` to modal backdrops and content containers.
5. Typography & Microcopy polish: replace `...` with `…`, ensure `tabular-nums` on numbers/timers.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React.

## Global Constraints
- Do not break existing features, state management, or calculation logic.
- Preserve all existing unit and integration tests (24/24 tests must continue to pass).
- Strictly adhere to `focus-visible:ring-2 focus-visible:ring-amber-400` styling for consistent interactive focus rings across all controls.

---

### Task 1: Global CSS, Skip Link & Focus Foundation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/layout/side-tab.tsx`
- Test: `tests/ui-foundation.test.mjs`

- [ ] **Step 1: Write verification test for skip link and globals**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update `globals.css` with global `:focus-visible` styles and smooth scrolling**
- [ ] **Step 4: Update `layout.tsx` with skip link (`<a href="#main-content">Skip to content</a>`) and `id="main-content"` on `<main>`**
- [ ] **Step 5: Fix invalid `backdrop-blur-xs` in `side-tab.tsx` to `backdrop-blur-sm`**
- [ ] **Step 6: Run test and verify it passes**

---

### Task 2: Animation Performance & Transition Cleanup (`transition-all`)

**Files:**
- Modify: `src/app/bond/page.tsx`
- Modify: `src/app/credits/page.tsx`
- Modify: `src/app/trekkers/page.tsx`
- Modify: `src/components/builder/build-card-export.tsx`
- Modify: `src/components/builder/potentials-picker-modal.tsx`
- Modify: `src/components/builder/potentials-slot-row.tsx`
- Modify: `src/components/builder/trekker-card.tsx`
- Modify: `src/components/builder/trekker-picker-modal.tsx`
- Modify: `src/components/calculator/level-stepper.tsx`
- Modify: `src/components/calculator/skills-matrix.tsx`
- Modify: `src/components/calculator/trekker-selector.tsx`
- Modify: `src/components/home/tools-grid.tsx`
- Modify: `src/components/roadmap/roadmap-timeline.tsx`
- Modify: `src/components/roadmap/unreleased-trekkers-bar.tsx`
- Test: `tests/ui-transitions.test.mjs`

- [ ] **Step 1: Write test checking that no `transition-all` exists in `src/`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Replace every `transition-all` with targeted transitions (`transition-colors`, `transition-[border-color,background-color]`, `transition-transform`)**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 3: Accessibility, Semantic HTML & ARIA Labels

**Files:**
- Modify: `src/app/bond/page.tsx` (stepper buttons `aria-label`, card semantics)
- Modify: `src/components/calculator/trekker-selector.tsx` (convert `div` trigger to `button`)
- Modify: `src/components/builder/potentials-slot-row.tsx` (convert slot trigger to `button`, add `aria-label="Remove potential"`)
- Modify: `src/components/builder/trekker-card.tsx` (add `aria-label="Remove trekker"`)
- Modify: `src/components/layout/top-bar.tsx`, `side-tab.tsx`, `navbar.tsx` (add `aria-hidden="true"` to decorative icons)
- Test: `tests/ui-accessibility.test.mjs`

- [ ] **Step 1: Write test checking semantic elements and aria-labels on icon buttons**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement semantic updates and accessible labels**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 4: Modal Ergonomics & Scroll Containment

**Files:**
- Modify: `src/components/builder/trekker-picker-modal.tsx`
- Modify: `src/components/builder/potentials-picker-modal.tsx`
- Modify: `src/components/roadmap/roadmap-item-details.tsx`
- Modify: `src/app/calculator/page.tsx` (mobile bill drawer)
- Test: `tests/ui-modals.test.mjs`

- [ ] **Step 1: Write test verifying `overscroll-contain` on modals and dialog containers**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Add `overscroll-contain` to modal overlay and content wrappers**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 5: Typography, Ellipses & Tabular Numbers

**Files:**
- Modify: `src/app/builder/page.tsx` (`...` -> `…`)
- Modify: `src/app/trekkers/page.tsx` (`...` -> `…`)
- Modify: `src/components/builder/trekker-picker-modal.tsx` (`...` -> `…`)
- Modify: `src/components/home/tools-grid.tsx` (`...` -> `…`)
- Modify: `src/components/builder/build-card-export.tsx` (`...` -> `…`)
- Modify: `src/app/bond/page.tsx` (loading `...` -> `…`)
- Modify: `src/components/home/reset-timer.tsx` (ensure `tabular-nums`)
- Modify: `src/components/calculator/materials-bill.tsx` (ensure `tabular-nums`)
- Test: `tests/ui-typography.test.mjs`

- [ ] **Step 1: Write test verifying no raw `...` in UI microcopy strings**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update strings and apply `tabular-nums`**
- [ ] **Step 4: Run test to verify it passes**

---

### Task 6: Full Suite Verification & Build Confirmation

- [ ] **Step 1: Run complete test suite (`node --test-concurrency=1 --test tests/*.test.mjs`)**
- [ ] **Step 2: Run Next.js production build (`npm run build`)**
