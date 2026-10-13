# TMD-WAR — UI/UX Design System & Experience Specification

**Design Inspiration:** Framer Websites (Refined Luxury, Precision Micro-Interactions, Minimalist Clarity)  
**Tone & Vibe:** High-end auction house, sleek dark obsidian canvas, warm champagne-gold accents, high-contrast typography, restrained motion.  

---

## 1. Visual Foundation & Design Tokens

### 1.1 Color Tokens
- **Canvas Base (`--bg-app`):** `#0A0B0D` — Rich, deep obsidian black offering depth and focus.
- **Canvas Subtle (`--bg-subtle`):** `#101216` — Subtle separation for secondary sections (trust bar, how-it-works).
- **Surface Cards (`--surface`):** `#14171D` — Elevated background for auction cards and detail panels.
- **Surface Elevated (`--surface-elevated`):** `#1A1E27` — Higher contrast container for inputs and metric boxes.
- **Borders (`--border`):** `rgba(255, 255, 255, 0.08)` — Delicate hairline borders creating precision structure.
- **Border Hover (`--border-hover`):** `rgba(217, 181, 103, 0.35)` — Subtle champagne illumination on interactive hover.
- **Primary Accent (`--gold`):** `#D9B567` — Refined warm gold representing value and premium auction prestige.
- **Gold Hover (`--gold-light`):** `#F0D28D` — High-visibility micro-lift on button hover.
- **Text Main (`--text-main`):** `#F6F5F1` — High-contrast off-white for effortless legibility (WCAG AAA).
- **Text Secondary (`--text-secondary`):** `rgba(246, 245, 241, 0.65)` — Balanced neutral for descriptions and metadata.
- **Text Muted (`--text-muted`):** `rgba(246, 245, 241, 0.42)` — Subtle labels, timestamps, and legal notes.

### 1.2 Status Color Semantics
- **Live Auction (`--status-live`):** `#EF4444` (Ruby red with pulsing beacon dot and transparent glow badge).
- **Scheduled Auction (`--status-sched`):** `#F59E0B` (Amber gold for impending lots).
- **Ended / Closed (`--status-ended`):** Muted silver (`rgba(255, 255, 255, 0.45)`).
- **Success (`--status-success`):** `#10B981` (Emerald green for accepted bids).

### 1.3 Typography Scale & Font Mechanics
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Numerals:** `font-variant-numeric: tabular-nums` strictly applied across all prices, lot numbers, counters, and countdown clocks to prevent layout shifts during live ticker updates.
- **Headline Tracking:** Tight letter-spacing (`-0.055em` to `-0.03em`) on major headlines for an authoritative editorial look.
- **Labels:** Uppercase tracking (`0.15em` to `0.25em`) with 9-11px sizing for subtle metadata hierarchy.

---

## 2. Navigation Architecture & User Journeys

### 2.1 Navigation Layout
- **Desktop:** Sticky top bar with brand badge, direct section links ("Beranda", "Katalog Lelang", "Cara Kerja"), account link, and auth status.
- **Mobile:** Accessible hamburger toggle opening a backdrop-blurred slide-down drawer with clear touch targets (minimum 44px height).
- **Active Route Highlighting:** Active routes feature a golden baseline accent pill.

### 2.2 Core User Journeys

#### Journey 1: Guest Discovery & Exploration
1. Guest lands on `/`.
2. Inspects Hero statistics: Total Lots, Live, and Scheduled count.
3. Views Featured Lot with real-time countdown clock and starting price.
4. Jumps to `#katalog`, uses category tabs ("Semua", "Sedang Live", "Segera Dimulai", "Selesai") or searches by keyword.
5. Clicks lot card and navigates to `/lelang/[id]`.

#### Journey 2: Bidding on an Active Lot
1. Bidder views lot on `/lelang/[id]`.
2. If unauthenticated, clicks "Masuk dengan Facebook untuk Menawar". Redirects safely to `/login` and returns back to the exact lot upon authentication.
3. Bidder sees real-time price and min increment.
4. Clicks quick-increment pill (`+1x`, `+2x`, `+5x`) or types custom amount.
5. Clicks "Ajukan Penawaran". Client validates amount instantly.
6. Server executes row-locked RPC. Bid is accepted and broadcasts to Supabase Realtime channel.
7. Bidder sees instant success notification, and the live bid history prepends their entry.

#### Journey 3: Account Monitoring
1. User clicks "Akun Saya" in the navbar.
2. Views profile details, verified bidder badge, total bids count, and highest bid placed.
3. Reviews personal bid history table with links back to each lot.

---

## 3. Responsive Breakpoint Matrix

| Viewport Width | Device Target | Layout Adjustments |
|---|---|---|
| **< 640px** | Mobile phones | Single-column catalog grid, stacked hero statistics, compact artwork ratio, mobile drawer navigation. |
| **640px - 820px** | Large phones / phablets | 2-column catalog grid, hamburger menu active, touch-optimized quick bid pills. |
| **820px - 1040px** | Tablets / Small laptops | 2-column catalog grid, desktop navbar links visible, side-by-side detail layout. |
| **> 1040px** | Desktop displays | 3-column catalog grid, full editorial hero with side-by-side featured lot card, full data tables. |

---

## 4. Accessibility & Motion Guidelines

1. **Contrast Compliance:** All text and interactive controls maintain at least 4.5:1 contrast against their respective backgrounds, meeting WCAG 2.2 Level AA requirements.
2. **Keyboard Navigation:** Custom `:focus-visible` ring (`2px solid var(--gold)`) with an `outline-offset` of 3px ensures clear keyboard focus.
3. **Screen Readers:** ARIA landmarks, `role="alert"` on feedback banners, and accessible names on icon buttons.
4. **Reduced Motion:** Full `@media (prefers-reduced-motion: reduce)` support instantly disables card lifts, image zooms, and transitions for users with motion sensitivities.
