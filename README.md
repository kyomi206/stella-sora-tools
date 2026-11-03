# Stella Sora Tools

A modern, fast web companion for Yostar's top-down action RPG **Stella Sora**. Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4.

---

## 🌟 Key Features

### 1. Home Dashboard (Inspired by Joe's Blue Archive Tools)
- Modeled after the aesthetic and clean layout of [ba-tools](https://github.com/jozsefsallai/ba-tools).
- **Tools Grid**: Fast access cards for Team Builder, Bond Calculator, and Trekker Encyclopedia.
- **Trekker of the Day**: Automatic daily spotlight with preferred gifts and squad advice.
- **Server Reset Countdown**: Real-time tracker for daily 04:00 UTC resets.
- **Changelog**: Release history and update notes.

### 2. Team Builder & Build Exporter (Inspired by Noya)
- Modeled after [noyanoya.vercel.app](https://noyanoya.vercel.app/) by `maj-rf`.
- **Three-Seat Squad Setup**:
  - **Vanguard**: Main on-field damage dealer.
  - **Versatile**: Off-field sub-DPS / elemental enabler.
  - **Support**: Buffs, shield, and ultimate support.
- **Interactive Potentials Customizer**: Choose Core, Rare, and Common potentials with in-game vestige frames and priority tagging.
- **Elemental Resonance Indicator**: Shows mono-element alignment and synergy bonuses.
- **Image Card Exporter**: Generates a high-resolution PNG image card using `html2canvas-pro` for Discord/X sharing.
- **Shareable URLs**: Instant link sharing with compressed build state (`lz-string`).

### 3. Heartlink & Bond Calculator
- Powered by official datamined affinity formulas from [Hiro420/StellaSoraData](https://github.com/Hiro420/StellaSoraData).
- Complete 1–99 level progression curve and cumulative EXP calculations with quick milestone targets (Lv 5, 10, 20, 30, 50, 70, 99).
- **Interactive Gift Calculator & Allocation**: Choose gift tiers (Exquisite Purple 2,000 EXP, Rare Yellow 500 EXP, Common Blue 150 EXP) and custom quantities, with instant EXP calculations, Loved Gift 1.5x multiplier, fill-to-target helpers, and auto-optimization.

### 4. Events Roadmap & Schedule
- Inspired by the Blue Archive roadmap timeline format (`road.png`).
- **Interactive Multi-Lane Schedule**: Spanning calendar dates across months with daily grid columns and horizontal parallel lane packing.
- **5 Core Categories**: Character Banners (Limited, Festival, Rate-Up), Boss Blitz raids (with recommended element weaknesses), Events (story campaigns and drop bonuses), Main Stories (chapter drops and interludes), and Cataclysm Survivor seasonal timestamps.
- **Timeline Controls**: Real-time "Today" marker with pulsing red indicator line, 1-click "Jump to Today" auto-scroll, category filter pills, instant search, dynamic zoom levels (Compact, Normal, Wide), and item detail inspection modals.

### 5. Trekker Encyclopedia
- Multilingual character directory with element badges (Ignis, Aqua, Terra, Ventus, Umbra, Lux), combat classes, star ratings, and quick links into the Team Builder or Bond Calculator.

### 6. Automated Game Data Sync (Powered by ElysiaJS)
- Integrated **ElysiaJS** backend running directly in Next.js App Router (`/api/[[...slugs]]`).
- **Live Sync Endpoints**:
  - `GET /api/health`: Health status.
  - `GET /api/data/characters`: Synced trekker roster and stats.
  - `GET /api/data/roadmap`: Synced recruitment banners, raids, and events.
  - `GET /api/data/potentials`: Synced potentials database.
  - `POST /api/sync`: On-demand datamine synchronization trigger.
- **Zero-Flicker Hydration**: Client components load initial static seeds immediately, then revalidate in the background via `@elysiajs/eden`.
- **Fault-Tolerant Cache**: In-memory + disk cache store (`.data-cache/`) with single-flight request deduplication and read-only static seed fallbacks.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm or pnpm

### Running Locally
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration
Copy `.env.example` to `.env.local` and set `SYNC_SECRET`. `POST /api/sync` requires `Authorization: Bearer <SYNC_SECRET>` and is rejected if the variable is unset.

### Building for Production
```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
blank/
├── public/
│   ├── ss-element/       # Elemental icons (Aqua, Ignis, Lux, Terra, Umbra, Ventus)
│   ├── ss-class/         # Attack type icons (Melee, Ranged)
│   ├── ss-vestige/       # Potential card rarity borders (vestige_0, 1, 2)
│   └── shy.png           # Mascot / placeholder icon
├── src/
│   ├── app/
│   │   ├── page.tsx      # Home Dashboard (ba-tools style)
│   │   ├── builder/      # Team Builder & Build Exporter (Noya style)
│   │   ├── bond/         # Heartlink / Bond Calculator
│   │   ├── trekkers/     # Trekker Encyclopedia
│   │   ├── layout.tsx    # Root layout with Navbar & Footer
│   │   └── globals.css   # Tailwind v4 theme
│   ├── components/
│   │   ├── layout/       # Navbar & Footer
│   │   ├── home/         # Dashboard widgets (ToolsGrid, ResetTimer, Spotlight)
│   │   └── builder/      # TrekkerCard, PotentialsSlotRow, PickerModals, CardExport
│   ├── data/
│   │   ├── characters.json # Playable Trekkers data
│   │   ├── potentials.json # Complete character potentials
│   │   └── affinity.ts     # Datamined EXP tables & gift optimizer
│   ├── lib/
│   │   └── utils.ts      # Classnames & LZString compression
│   └── types/
│       └── index.ts      # TypeScript interfaces
```

---

## 📜 Credits & Acknowledgments
- **Stella Sora**: Developed by Yostar.
- **Noya**: Created by [maj-rf](https://github.com/maj-rf/noya).
- **StellaSoraData**: Datamined by [Hiro420](https://github.com/Hiro420/StellaSoraData).
- **Blue Archive Tools**: UI layout inspiration from [jozsefsallai/ba-tools](https://github.com/jozsefsallai/ba-tools).
- **Stella Sora Miraheze Wiki**: Community documentation at [stellasora.miraheze.org](https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki).

---

## License

Licensed under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE).

Unofficial fan project, not affiliated with Yostar. Stella Sora names, art and game data belong to their respective owners.
