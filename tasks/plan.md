# Implementation Plan: Fidex MotionSites Dual-Theme Redesign

## Overview
Redesign the **Fidex** application to match the approved MotionSites / Viktor Oddy aesthetic: tactile 3D physical artifacts, Swiss modernist brutalist typography, industrial crop marks, inline barcodes, and a seamless dual-theme system (warm studio ivory light mode and velvet obsidian dark mode with zero green tint).

## Architecture Decisions
1. **Theme System**: CSS variable-driven with `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`. Persisted in `localStorage` with `useSyncExternalStore` for hydration safety.
2. **Color Tokens**:
   - Light: `--bone: #f6f5f1; --ink: #0d0d0d; --mute: #6b6760; --line: rgba(13, 13, 13, 0.12);`
   - Dark: `--bone: #0c0c0e; --ink: #f4f0e6; --mute: #8e8a82; --line: rgba(244, 240, 230, 0.12);` (Strictly zero green/neon tints).
3. **Asset Strategy**: Pre-rendered high-res 3D metallic plates in `public/plates/` optimized via `next/image` with SVG technical micro-accents.
4. **Component Isolation**: Modular components (`Barcode`, `CropMark`, `ThemeToggle`, `MarketTable`, `Paywall`) adhering to WCAG 2.1 AA standards.

## Task List

### Phase 1: Dual-Theme Architecture & Assets (Foundation)
- [x] Task 1: Configure dual-theme CSS variables and global typography in `app/lookbook.css`
- [x] Task 2: Place 3D metallic letter plate assets in `public/plates/`
- [x] Task 3: Build `components/ThemeToggle.tsx`, `components/Barcode.tsx`, and `components/CropMark.tsx`

### Checkpoint: Foundation
- [x] Build compiles cleanly (`npm run build`)
- [x] Theme toggles between Light and Dark seamlessly without hydration mismatch

### Phase 2: Homepage Redesign (Vertical Slice 1)
- [x] Task 4: Update `components/LookbookNav.tsx` with high-fashion spacing, theme toggle, and minimal wireframe actions
- [x] Task 5: Overhaul `components/LookbookHero.tsx` to match the exact approved layout (stacked typography, inline barcode, wireframe CTA, 3D letter centerpiece, and metadata badge)

### Checkpoint: Homepage
- [x] Homepage renders identically to the approved mockup in both Light and Dark mode
- [x] Responsive test across mobile and desktop breakpoints

### Phase 3: Markets Specimen Ledger (Vertical Slice 2)
- [x] Task 6: Redesign `app/markets/page.tsx` and `components/MarketTable.tsx` as an editorial specimen ledger with category filter pills, grade stamps, and `VIEW PLATE ↗` buttons

### Checkpoint: Markets
- [x] All 19 protocols render with proper scores and interactive filtering

### Phase 4: Protocol Dossier Page (Vertical Slice 3)
- [x] Task 7: Redesign `app/p/[slug]/page.tsx` with minted ingot plate, thesis lede, brutalist x402 paywall card, and calibrated Nine Axes gauge bars

### Checkpoint: Full Verification
- [x] Full build and test suite passes (`npm run build`, `npm run lint`)
- [x] All routes (`/`, `/markets`, `/p/[slug]`) fully verified in both light and dark themes
