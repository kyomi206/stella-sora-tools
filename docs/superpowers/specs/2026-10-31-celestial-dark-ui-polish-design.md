# Refined Celestial Dark UI Polish — Design Spec

**Date:** 2026-10-31
**Scope:** Small Change (Token & Component-Level UI Polish across `~/sstt/blank`)

## 1. Intent & Why
Elevate **Stella Sora Tools** from a flat, utilitarian dark-slate template into an appealing **Refined Celestial Dark** companion web app. Preserve the fast, clean layouts players already use while adding subtle celestial warmth (amber/starlight & indigo accents, richer surface elevation, top-edge card highlights) and fixing cross-page UI inconsistencies and mobile header duplication.

## 2. Goals, Non-Goals & Anti-Goals
- **Goals:**
  - Enrich CSS design tokens in `src/app/globals.css` with subtle celestial dark depth, refined surface elevation, and consistent custom range slider styling.
  - Merge the duplicate mobile headers (`SideTab` + `TopBar`) into a single unified mobile header and add warm amber active indicators + tool-colored icon accents to the sidebar.
  - Polish the Home page (`src/app/page.tsx`) while keeping its exact section order: balance the 5-card tools grid (2-column grid with the 5th card spanning/centered cleanly), unify section heading typography, and display role/element badges in `TrekkerSpotlight` without extra action buttons.
  - Unify `Bond & Affinity Calculator` and `Resource Calculator`: fix `TrekkerSelector` to render its `subtitle` prop and use the authentic 5★ prismatic card border/bars, give Bond the same amber range sliders and compact `- / +` steppers as Resource Calculator, fix oversized `44×44px` desktop stepper buttons in `LevelStepper`, and standardize page header spacing/typography across all routes.
  - Apply the Refined Celestial Dark surface and button tokens to `Preset Visualizer` (`src/app/builder/page.tsx`), `Events Roadmap` (`src/app/roadmap/page.tsx`), `Trekker Encyclopedia` (`src/app/trekkers/page.tsx`), and `Credits` (`src/app/credits/page.tsx`) without altering their layouts or behaviors.
- **Non-Goals:**
  - Installing external component libraries (Radix UI / shadcn CLI packages) or adding a light mode theme.
  - Restructuring the Home page section order or redesigning the Squad Builder's two-part workflow.
- **Anti-Goals:**
  - Heavy neon cyberpunk glows, noisy background textures, or sluggish animations that hurt readability and utility speed.

## 3. Constraints
- Pure **Tailwind CSS v4** + CSS custom properties in `src/app/globals.css` with zero new npm dependencies.
- Maintain WCAG AA contrast, keyboard `:focus-visible` rings, and `prefers-reduced-motion` support.
- Preserve `#team-card-export` rasterization compatibility with `html2canvas-pro` in `BuildCardExport`.

## 4. Approaches Considered
1. **Approach 1: Token & Component-Level Polish (Selected)** — Upgrade CSS tokens in `globals.css` and refine the ~10 existing layout/page/component files in place. Chosen because it resolves every visual bug and hardcoded hex drift with minimal churn and zero unnecessary abstractions.
2. **Approach 2: Shared UI Primitives Extraction (`src/components/ui/*`)** — Extract `<PageHeader>`, `<SurfaceCard>`, and `<RangeStepper>` primitives across all routes. Rejected as over-abstracted for a focused polish pass where page layouts are already settled.
3. **Approach 3: CSS-Only Surface & Theme Pass** — Restrict edits almost entirely to `globals.css` plus tiny bugfixes. Rejected because hardcoded hex values (`#131720`, `#1a202c`) and mismatched calculator controls require component-level alignment.

## 5. Key Decisions Settled
- **Visual Direction:** Refined Celestial Dark — preserve core root tokens (`--color-base: #0c0e12`, `--color-surface: #131720`, `--color-border: #23293a`, `--color-accent: #f59e0b`) while adding `.celestial-card` / `.celestial-surface` elevation utilities with top-edge inner specular highlights (`inset 0 1px 0 0 rgba(255,255,255,0.06)`), warm starlight amber (`#f59e0b`) primary accents, and a soft celestial indigo/amber radial ambient backdrop on `body`.
- **Home Page (`src/app/page.tsx`):** Keep `Header` → `Tools & Calculators` → `Trekker of the Day & Reset Time` → `Changelog`. Keep the 2-column tools grid with the 5th card (`Trekker Encyclopedia`) spanning cleanly across the bottom row (`md:col-span-2`), unify section headings, and keep `Trekker of the Day` minimal (avatar, name, rarity, element, and role badge).
- **Navigation (`side-tab.tsx`, `top-bar.tsx`):** Single unified sticky header bar on mobile (`< md`) containing brand, current page breadcrumb, and drawer toggle. Desktop sidebar uses a warm amber active bar (`border-amber-400`) and subtle tool-colored icons on active/hover states.
- **Squad Builder (`builder/page.tsx`):** Keep the exact 3-slot top + Live Preview bottom layout and behavior; replace hardcoded hexes with the new Celestial Dark surface/border tokens and polished button states.
- **Calculators (`bond/page.tsx`, `calculator/page.tsx`, `trekker-selector.tsx`, `level-stepper.tsx`):**
  - `TrekkerSelector` renders its `subtitle` prop (with page-appropriate copy on Bond vs. Resource Calculator) and matches the 5★ prismatic gradient (`from-[#c084fc] via-[#818cf8] to-[#38bdf8]`) used in Builder and Encyclopedia.
  - Both calculators share styled amber range sliders and compact `- / +` stepper buttons (`size-7` on desktop, touch-friendly on mobile).
  - Standardize page header padding (`py-6`), title typography (`text-2xl sm:text-3xl font-bold`), and right-aligned status pills across all tool pages.

## 6. Left to the Builder
- Exact alpha values for the subtle radial background glow and card hover elevation shadows.
- Responsive breakpoint fine-tuning on mobile breadcrumb truncation in `TopBar`.
