# TMD-WAR — Comprehensive Repository Audit & Modernization Report

**Audit Date:** October 2026  
**Auditor:** Senior Full-Stack Software Engineer & Software Architect  
**Repository:** https://github.com/operatorscc/tmdwar.git  
**Target Stack:** Next.js 15 (App Router, React 19, TypeScript), Supabase (PostgreSQL, Auth, RLS, Realtime), Vanilla CSS Modern Design System  

---

## Executive Summary

TMD-WAR is an online auction web application (MVP) built on Next.js 15 App Router and Supabase. The platform provides a public catalog of live and scheduled auctions, user authentication via Supabase Auth (Facebook OAuth), role-based authorization (`bidder` vs `admin`), and row-level locked atomic bidding via a PostgreSQL stored procedure (`place_bid`).

The audit revealed that while the core database transaction model (`place_bid` with `SELECT ... FOR UPDATE`) is sound, the application suffered from critical architectural fractures, visual inconsistencies, build/lint errors, and broken workflows:
1. **Unresolved Git Conflict:** `README.md` contained raw git merge conflict markers (`<<<<<<< HEAD` / `>>>>>>> cd1a...`).
2. **Missing Environment Configuration:** `.env.example` was missing despite `.gitignore` and `README.md` explicitly referencing it.
3. **Inconsistent Environment Variables:** `lib/supabase/server.ts` looked for `NEXT_PUBLIC_SUPABASE_ANON_KEY`, whereas `lib/supabase/client.ts`, `middleware.ts`, and the documentation used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. **Invalid Image Configuration:** `next.config.ts` included the protocol `https://` in `hostname`, violating Next.js remotePatterns syntax.
5. **Linting Failure:** ESLint 9 was installed with no configuration (`eslint.config.mjs` missing), causing `npm run lint` to fail with exit code 1.
6. **Layout & Styling Fracture:** `app/page.tsx` contained its own duplicate `<header>` and `<footer>` alongside `app/layout.tsx`. Furthermore, `app/page.tsx` used Tailwind utility classes, but Tailwind was not installed or configured. The rest of the app used outdated CSS styles, resulting in visually broken and disjointed pages.
7. **Missing Client Realtime & Live Countdowns:** Even though the database schema added `auctions` and `bids` to the `supabase_realtime` publication, the frontend lacked any real-time subscriptions, leaving users with stale prices unless they manually reloaded. No countdown timers were present.
8. **Missing Suspense Boundaries:** `app/login/page.tsx` accessed `useSearchParams()` directly in a client component without a `<Suspense>` wrapper, risking Next.js client-side de-optimizations.
9. **Absence of Quality Gates & Automated Tests:** No test framework or scripts were configured in `package.json`.

---

## 1. Stack and Architecture Discovery

### 1.1 Technical Stack
- **Framework:** Next.js 15.5.0 (App Router), React 19.1.0, React DOM 19.1.0.
- **Language & Runtime:** TypeScript 5.8.0, Node.js 20+.
- **Database & Auth:** Supabase PostgreSQL with `pgcrypto`, Supabase SSR (`@supabase/ssr` 0.7.0), Supabase JS (`@supabase/supabase-js` 2.57.0).
- **Styling:** Vanilla CSS (`globals.css`), custom Framer-inspired design tokens.
- **Icons:** `lucide-react` 0.468.0.

### 1.2 Routing Architecture
- `/` (`app/page.tsx`): Landing page, featured lot showcase, auction catalog grid, guide/how-it-works section.
- `/lelang/[id]` (`app/lelang/[id]/page.tsx`): Auction lot detail, high-resolution product imagery, current bid display, live bid history, and interactive bid submission form (`bid-form.tsx`).
- `/akun` (`app/akun/page.tsx`): Authenticated user profile dashboard and personal bid history (protected route, redirects unauthenticated users to `/login`).
- `/login` (`app/login/page.tsx`): Facebook OAuth entry point with safe `next` parameter redirection.
- `/auth/callback` (`app/auth/callback/route.ts`): OAuth code exchange for cookie session.
- `/auth/signout` (`app/auth/signout/route.ts`): Server-side session termination.

### 1.3 Database & Concurrency Model
- `public.profiles`: Stores user details synchronized via `on_auth_user_created` trigger on `auth.users`. Role defaults to `bidder`.
- `public.auctions`: Stores auction items, start/end timestamps, starting price, min increment, current price, and status (`scheduled`, `live`, `ended`, etc.).
- `public.bids`: Immutable record of bids placed.
- `public.place_bid(p_auction_id, p_amount)`: PostgreSQL stored procedure executed with `SECURITY DEFINER`. Uses `SELECT * FROM auctions WHERE id = p_auction_id FOR UPDATE` to lock the auction row, ensuring strict serializability against race conditions and concurrent double-bids.

---

## 2. Identified Vulnerabilities, Bugs, and Defects

| ID | Category | Description | Severity | Impact |
|---|---|---|---|---|
| **BUG-01** | Repository Integrity | Unresolved Git merge conflict markers in `README.md`. | High | Corrupted documentation, failed repo cleanliness. |
| **BUG-02** | Config / DX | Missing `.env.example` file. | Medium | Setup failures for new developers. |
| **BUG-03** | Auth / Env | Env key mismatch (`ANON_KEY` in `server.ts` vs `PUBLISHABLE_KEY` in `client.ts` / `middleware.ts`). | High | Server calls crash with undefined key if following documentation. |
| **BUG-04** | Runtime / Next.js | Invalid hostname `https://...` in `next.config.ts` remotePatterns. | Medium | Image optimization runtime errors on external images. |
| **BUG-05** | Tooling / Quality | Missing `eslint.config.mjs` causing `npm run lint` failure. | High | CI/CD build and lint pipeline failures. |
| **BUG-06** | UI / Architecture | Duplicate Header and Footer (`app/layout.tsx` + `app/page.tsx`). | High | Broken user experience, visual clutter, double rendering. |
| **BUG-07** | UI / Styling | `app/page.tsx` used uncompiled Tailwind classes; styling disconnected across routes. | High | Unstyled home page, jarring aesthetic discrepancies. |
| **BUG-08** | UX / Performance | `app/login/page.tsx` calls `useSearchParams` without `<Suspense>`. | Medium | Client-side bailout and potential hydration glitches. |
| **BUG-09** | Realtime / Product | No real-time updates for auctions and bids despite SQL publication setup. | High | Users see stale prices, cannot participate effectively in live bids. |
| **BUG-10** | UX / Features | Missing countdown timer for auction closing and opening times. | Medium | Poor bidder clarity regarding remaining time. |
| **BUG-11** | Mobile UX | Navigation links hidden on mobile screens with no alternate menu or drawer. | High | Mobile users unable to navigate to catalog or guide. |
| **BUG-12** | Test Coverage | Zero automated tests in repository. | Medium | High regression risk during updates. |

---

## 3. Prioritized Remediation Plan

### Phase A: Core Tooling, Config & Documentation (Immediate)
1. Clean up `README.md` conflict markers and consolidate documentation.
2. Create `.env.example` with standard Supabase variables and fallback handling.
3. Fix `lib/supabase/server.ts` to support both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` gracefully.
4. Correct `next.config.ts` remotePatterns hostname format.
5. Setup ESLint 9 configuration (`eslint.config.mjs`) compatible with Next.js 15 and TypeScript.
6. Add Node.js test runner suite (`tests/unit.test.ts`) covering currency formatting, status calculations, and validation logic.

### Phase B: Design System & Framer-Inspired UI Modernization
1. Unify the design system in `app/globals.css` with a refined luxury aesthetic:
   - Deep obsidian/slate palette (`#090A0C`, `#111317`, `#161920`, `#1E222B`).
   - Elegant champagne/amber accents (`#D4AF37`, `#F3D78A`).
   - Framer-quality typography, micro-spacing, subtle borders (`rgba(255,255,255,0.08)`), and smooth transitions.
   - Respect `prefers-reduced-motion`.
2. Consolidate layout: Remove duplicate header and footer from `app/page.tsx`, move universal responsive header and footer to `app/layout.tsx`.
3. Provide responsive mobile navigation with accessible toggle and active state indicators.

### Phase C: Auction Features, Real-Time & Live Interaction
1. Implement client-side Supabase Realtime channel on `/lelang/[id]` to live-stream price updates and new bids.
2. Build live countdown timers with remaining hours/minutes/seconds for active lots.
3. Enhance `bid-form.tsx` with quick-bid increment buttons (`+50k`, `+100k`, `+500k`) and instant feedback.
4. Wrap `app/login/page.tsx` search parameters in `<Suspense>`.

### Phase D: Quality Verification & Delivery
1. Run `npm run lint` and verify clean execution.
2. Run `tsc --noEmit` to verify type completeness.
3. Run test suite to verify regression coverage.
4. Run `npm run build` to confirm production build succeeds.
5. Create comprehensive architecture, bug fixes, and UI/UX documentation in `docs/`.
