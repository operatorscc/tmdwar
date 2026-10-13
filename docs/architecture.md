# TMD-WAR — End-to-End System Architecture

**Last Updated:** October 2026  
**Status:** Modernized & Verified  
**Runtime:** Node.js 20+ / Node.js 24 (Next.js 15 App Router, React 19, TypeScript)  
**Database & Auth:** Supabase PostgreSQL with Row-Level Locking and Supabase SSR  

---

## 1. High-Level Architecture Overview

TMD-WAR is an online curated auction house web application designed to handle high-stakes timed and live auctions with concurrency protection and transparent price tracking.

```
┌──────────────────────────────────────────────────────────┐
│                      Client Browser                      │
│   (Vanilla CSS Design System, Responsive Drawer, Tabs)   │
└───────────────▲──────────────────────────▲───────────────┘
                │ HTTP / SSR Requests      │ Supabase Realtime
                ▼                          ▼ (postgres_changes)
┌─────────────────────────────────┐   ┌────────────────────┐
│      Next.js 15 App Router      │   │ Supabase Realtime  │
│  - app/page.tsx (Catalog)       │   │ Publication Engine │
│  - app/lelang/[id] (Live Lot)   │   └─────────▲──────────┘
│  - app/akun (Protected Profile) │             │
│  - app/login (Facebook Auth)    │             │
│  - app/auth/callback (OAuth)    │             │
└───────────────┬─────────────────┘             │
                │ Supabase Server Client        │
                ▼ (PostgreSQL Session)          │
┌───────────────────────────────────────────────┴──────────┐
│                   Supabase PostgreSQL                    │
│  - public.auctions (Items & status)                      │
│  - public.bids (Immutable bid transactions)              │
│  - public.profiles (Auth synced roles)                   │
│  - public.place_bid(uuid, bigint) [SELECT ... FOR UPDATE]│
└──────────────────────────────────────────────────────────┘
```

---

## 2. Module Boundaries & Directory Structure

```
├── app/
│   ├── layout.tsx                # Universal RootLayout (Navbar + Footer + Session)
│   ├── globals.css               # Framer-inspired modern dark design system tokens
│   ├── page.tsx                  # Landing page (Hero, Stats, Featured Lot, Catalog, Guide)
│   ├── akun/
│   │   └── page.tsx              # Authenticated user account & bid history dashboard
│   ├── login/
│   │   └── page.tsx              # Suspense-wrapped OAuth Facebook login
│   ├── lelang/[id]/
│   │   ├── page.tsx              # Server Component loader for auction lot
│   │   ├── auction-live-view.tsx # Real-time client subscriber & live room
│   │   └── bid-form.tsx          # Interactive bid submission with quick increment pills
│   └── auth/
│       ├── callback/route.ts     # OAuth session code exchange & safe redirection
│       └── signout/route.ts      # Server-side cookie cleanup & logout
├── components/
│   ├── Navbar.tsx                # Accessible sticky header & mobile navigation drawer
│   ├── Footer.tsx                # Universal footer with legal disclaimers
│   ├── StatusBadge.tsx           # Status (Live/Scheduled/Ended) & Mode badges
│   ├── Countdown.tsx             # Client-side 1s precision ticking countdown timer
│   └── CatalogFilter.tsx         # Tabbed filter, search bar & lot card grid
├── lib/
│   ├── auction.ts                # Pure domain logic: state calculator, validation, redirect safety
│   ├── money.ts                  # Safe IDR currency formatter (rupiah)
│   └── supabase/
│       ├── client.ts             # Browser-side Supabase client with credentials fallback
│       └── server.ts             # Server-side Supabase client with cookie handlers
├── supabase/
│   └── schema.sql                # Complete DDL, RLS policies, trigger & RPC place_bid
├── tests/
│   └── auction.test.ts           # Automated test suite using Node built-in test runner
├── docs/
│   ├── audit-report.md           # Discovery findings and modernization roadmap
│   ├── architecture.md           # System architecture and request flow
│   ├── bug-fixes.md              # Documented bugs, root causes, and fixes
│   └── ui-ux.md                  # Design system, Framer aesthetics, and accessibility
├── next.config.ts                # Next.js configuration (Remote patterns)
├── eslint.config.mjs             # ESLint 9 flat configuration
└── tsconfig.json                 # TypeScript 5.8 configuration with bundler resolution
```

---

## 3. Request & Data Lifecycle

### 3.1 Public Catalog Browsing
1. User visits `/` or `/lelang/[id]`.
2. Next.js Server Component executes `createClient()` from `lib/supabase/server.ts`.
3. An anonymous read query fetches auctions with `status IN ('scheduled', 'live', 'ended')`.
4. RLS policy `"Public can read published auctions"` validates read permissions.
5. `getAuctionState()` evaluates `starts_at` and `ends_at` against current server timestamp.
6. The HTML is streamed to client with full metadata, fast Time to First Byte (TTFB), and responsive layout.

### 3.2 Real-time Auction Observation
1. User opens `/lelang/[id]`.
2. `AuctionLiveView` client component initializes a Supabase WebSocket channel: `auction-room-[id]`.
3. It listens to `postgres_changes` on:
   - `auctions` table updates (captures price updates and status changes).
   - `bids` table inserts (prepends incoming bids into the live bid list).
4. No page reloads or polling intervals required.

### 3.3 Atomic Bid Submission
1. Authenticated user inputs an amount (or clicks a `+1x`, `+2x`, `+5x` increment pill) on `bid-form.tsx`.
2. Client validation runs `validateBid(amount, currentPrice, startingPrice, minIncrement)`.
3. Client dispatches `supabase.rpc("place_bid", { p_auction_id, p_amount })`.
4. Postgres executes `public.place_bid`:
   - Checks caller authentication: `v_uid := auth.uid()`.
   - Prevents admin self-bidding.
   - Executes `SELECT * FROM auctions WHERE id = p_auction_id FOR UPDATE;` (Locks the auction row).
   - Verifies auction is `status = 'live'` and within active time window (`starts_at <= now < ends_at`).
   - Ensures `p_amount >= v_auction.current_price + v_auction.min_increment`.
   - Inserts row into `public.bids`.
   - Updates `public.auctions.current_price = p_amount`.
   - Commits transaction and releases row lock.
5. Realtime broadcasts update to all subscribers.

---

## 4. Security & Authorization Matrix

| Layer | Responsibility | Implementation |
|---|---|---|
| **Edge / Middleware** | Cookie sync & session refresh | `middleware.ts` runs on all App Router paths, ensuring active session token rotation. |
| **Authentication** | Social OAuth (Facebook) | Handled by Supabase Auth with server code exchange at `/auth/callback`. |
| **Open Redirect Defense** | Target URL sanitization | `getSafeRedirect()` prevents external redirect exploitation (e.g. `//evil.com`). |
| **Row-Level Security (RLS)** | Data access authorization | All mutations on `bids` are revoked; only `place_bid` RPC has `SECURITY DEFINER` access. |
| **Admin Enforcement** | Privilege isolation | Role stored in `public.profiles.role`. Evaluated strictly on server; client cannot mutate role. |
| **Secrets Protection** | Credential boundaries | Service role keys are never included in code or client bundles. |
