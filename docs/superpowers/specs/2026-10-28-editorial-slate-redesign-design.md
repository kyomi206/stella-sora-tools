# Design Document: Editorial Slate & Minimal Craft Redesign

## 1. Intent & Context
Stella Sora Tools (SSBS) is a fan-made web companion for Yostar's anime action RPG *Stella Sora*. The current interface features working tools (Team Builder, Bond Calculator, Resource Calculator, Events Roadmap, and Trekker Encyclopedia), but displays several generic "AI template" patterns:
- An oversized marketing hero banner dominating the home screen and pushing functional tools below the fold.
- Ubiquitous amber (`#f59e0b`) accent applied indiscriminately across UI chrome, icons, and borders.
- "Icon-in-a-box" tool cards with stock paragraphs.
- Monospace styling on non-code UI elements and jarring instant modal dialog popups.

This redesign elevates the web app into a calm, minimalist editorial companion (**Approach A: Editorial Slate & Quiet Craft**), stripping template noise, refining typography and spacing, reserving color strictly for in-game data (elements, rarities), and introducing restrained micro-interactions.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Minimalist Editorial Atmosphere**: Quiet, high-end dark slate palette (`#0a0c10` ground, `#11141c` panels, `#1a202c` 1px borders) with spacious layout and disciplined type hierarchy.
- **Data-First Color Discipline**: Removal of amber accent from neutral chrome. Vibrant color is strictly reserved for Stella Sora game data: the 6 Elements (Ignis, Aqua, Terra, Ventus, Umbra, Lux), rarity stars (5★ Purple, 4★ Gold, 3★ Blue), and status badges.
- **Compact Home Dashboard**: Transform the home landing view so users can access primary tools without unnecessary scrolling.
- **Restrained Micro-Interactions**: Implement high-leverage Kowalski micro-interactions:
  - Subtle modal dialog entrance (`scale(0.97)` + fade over 180ms).
  - Tactile button and card press feedback (`:active { transform: scale(0.98) }`).
  - Smooth sidebar width transition without text reflow jitter.
  - Full support for `@media (prefers-reduced-motion: reduce)`.
- **Page Coverage**: Overhaul Home, Sidebar/Navbar, Trekker Encyclopedia, Bond Calculator, Resource Calculator, and Roadmap.

### Non-Goals
- Adding new game features, datamined formulas, or unrelated routes.
- Migrating underlying frameworks (Next.js 16 App Router, React 19, Tailwind CSS v4 remain unchanged).
- Light mode implementation (this is purely a refined dark tactical interface).

### Anti-Goals & Constraints
- **CRITICAL CONSTRAINT: Do NOT touch the Team Building page layout or preview window.** The Team Builder (`/builder`), its 3-seat squad setup (Vanguard, Versatile, Support), potentials selector, and especially the high-resolution canvas card export preview (`BuildCardExport`) must remain functional and visually stable.
- **No Gratuitous Animations**: No bouncing numbers, no continuous ticking animations, no delayed page transitions, and no staggered list entrances during rapid filtering.

---

## 3. Approaches Considered

### Approach A: Editorial Slate & Quiet Craft *(Selected)*
- **Summary**: Refined dark slate styling, flat tone steps, generous breathing room, quiet typography, and zero chrome color. All color pops stem authentically from game data (character art, elements, and rarities).
- **Pros**: Balanced, elegant, eliminates visual fatigue, keeps high utility while respecting the game's official visual assets.
- **Cons**: Requires thoughtful typography and spacing to avoid looking overly sparse.

### Approach B: Utilitarian Zen (Strict Linear Monochrome)
- **Summary**: Monochromatic linear wireframe aesthetic (pure black/charcoal, border-only cards, desaturated element glyphs, table-index home view).
- **Pros**: Extremely simple, zero clutter.
- **Cons**: Strips out game personality; feels clinical and disconnected from an anime RPG companion.

**Decision**: Approach A was chosen by the user for its calm, premium editorial feel and authentic appreciation of game assets.

---

## 4. Architectural & Component Details (Builder Resolved)

### 4.1 Global Styles & Tokens (`src/app/globals.css`)
- Root background: `#0c0e12` (with slate surface hierarchy).
- Backward-compatible token preservation in `globals.css`:
  - `--color-base: #0c0e12`
  - `--color-surface: #11141c` (refined from `#131720`)
  - `--color-surface-hover: #161b26`
  - `--color-border: #1a202c` (refined from `#23293a`)
  - `--color-accent: #f59e0b` (kept in CSS root for test harness backward-compatibility, but suppressed from neutral UI chrome)
- Elemental Hues (mapped to game data):
  - Ignis: `rose-500` / `#f43f5e`
  - Aqua: `sky-500` / `#0ea5e9`
  - Terra: `amber-500` / `#f59e0b`
  - Ventus: `emerald-500` / `#10b981`
  - Umbra: `purple-500` / `#a855f7`
  - Lux: `yellow-500` / `#eab308`
- Global active press utility:
  ```css
  @media (hover: hover) and (pointer: fine) {
    .press-feedback:active {
      transform: scale(0.98);
      transition: transform 120ms ease-out;
    }
  }
  ```
- Motion reduction:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### 4.2 Layout & Navigation (`src/components/layout/side-tab.tsx`, `footer.tsx`)
- **Desktop Sidebar**:
  - Border: `border-r border-[#1a202c]`, background `#0c0f15`.
  - Brand header: Replace bright amber star with a clean, low-profile monogram/symbol in muted slate.
  - Nav links: Neutral text (`text-slate-400 hover:text-slate-200 hover:bg-[#161b26]`).
  - Active state: Subtle flat background `#181e2b`, crisp white text, and a quiet 2px left indicator. No glowing amber backgrounds.
  - Collapse transition: Fixed width transition (`transition: width 200ms cubic-bezier(0.2, 0, 0, 1)`) with text labels fading cleanly (`opacity 120ms ease-out`) to prevent jarring label wrapping.
- **Footer**:
  - Low-key, quiet copyright, datamine credit, and disclaimer in `text-xs text-slate-500`.

### 4.3 Home Dashboard (`src/app/page.tsx`, `src/components/home/`)
- **Header**:
  - Replace 250px marketing hero banner with a compact, confident title section:
    - Title: "Stella Sora Tools" (`text-2xl sm:text-3xl font-bold tracking-tight text-white`).
    - Subtitle: One calm sentence explaining the suite.
    - Reference links (GitHub datamine, Miraheze wiki) placed as quiet inline text links.
- **Tools Grid (`tools-grid.tsx`)**:
  - Eliminate the "icon-in-a-box" container (`size-10 bg-black border-amber-400`).
  - Clean card design:
    - Subtle `1px border border-[#1a202c] bg-[#11141c] hover:border-[#283245] transition-colors p-5 rounded-xl`.
    - Integrated inline title with sleek icon and subtle arrow link.
    - Crisp 2-line summary in `text-xs sm:text-sm text-slate-400`.
- **Spotlight & Reset Timer (`trekker-spotlight.tsx`, `reset-timer.tsx`)**:
  - Reset timer: Tabular numbers (`tabular-nums font-mono text-xl`), calm progress indicator, removal of unnecessary orange glows.
  - Trekker spotlight: Character art presented crisply with elemental badge and liked gift tier.

### 4.4 Trekker Encyclopedia (`src/app/trekkers/page.tsx`)
- Filter bar: Remove bulky container; use clean inline pill filters for Elements and Combat Roles, with active element pills glowing in their authentic elemental hue rather than universal amber.
- Search input: Minimalist recessed field (`bg-[#0c0f15] border border-[#1a202c] focus:border-slate-500`).
- Character Cards:
  - Preserve game-authentic role banner (`clip-path:polygon`) and rarity bar (tested in `trekker-cards.test.mjs`).
  - Clean outer card surface with 1px border (`border-[#1a202c] hover:border-[#2b3548]`).
  - Instant filtering (no artificial stagger delay).

### 4.5 Calculators & Roadmap (`bond/`, `calculator/`, `roadmap/`)
- **Bond & Resource Calculators**:
  - Clean stepper buttons with tactile `:active` state.
  - Gift cards: Rarity borders (Exquisite Purple, Rare Yellow, Common Blue) kept intact, but background tints softened for high legibility.
  - Mobile material drawer: Smooth 220ms slide-up transition from bottom screen edge.
- **Roadmap Timeline**:
  - Remove unnecessary `font-mono` badges in header pills.
  - Tighten timeline header; ensure "Today" marker line has a clean vertical highlight.

### 4.6 Team Builder & Picker Modals Policy
- **Freeze Boundary**: `/builder` squad grid, slot layout, potential sockets, and `BuildCardExport` canvas preview remain completely unchanged to protect export PNG dimensions and layout stability.
- **Picker Modals**: `trekker-picker-modal.tsx` and `potentials-picker-modal.tsx` only receive an outer entrance animation enhancement on their dialog container:
  ```css
  animate-in fade-in zoom-in-95 duration-180
  ```
  with backdrop fade-in, without disrupting any internal slot-selection or potential-assignment state.

### 4.7 Test Suite Consistency
- Preserve all existing token names and structural patterns so `tokens-and-layout.test.mjs` and `trekker-cards.test.mjs` continue to pass without regression.

---

## 5. What is Left to the Builder
- Exact padding and spacing values inside sub-components (within Tailwind standard scales 4, 5, 6).
- Ensuring zero regression in responsive breakpoints (mobile drawer vs desktop sidebar).
- Verifying that `npm run build` and existing test scripts run with 0 errors.
