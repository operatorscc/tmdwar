# TMD-WAR — Defect Log & Remediation Report

**Date:** October 2026  
**Status:** All Critical and Major Issues Remediated and Verified  

---

## 1. Summary of Fixed Issues

| Issue Key | Summary | Severity | Root Cause | Remediation | Verification Evidence |
|---|---|---|---|---|---|
| **FIX-01** | Git merge conflict markers in `README.md` | High | Unresolved merge commit left `<<<<<<< HEAD` and conflict tails in documentation. | Cleaned up merge markers, reconciled content into unified comprehensive manual. | `git status` clean, no conflict markers detected by regex search. |
| **FIX-02** | Missing `.env.example` file | Medium | `.env.example` was excluded by default or omitted during initial repository commit. | Created `.env.example` containing documented environment variables and fallbacks. | File present, matches setup guide. |
| **FIX-03** | Mismatch and unhandled environment variable keys | High | `server.ts` looked for `NEXT_PUBLIC_SUPABASE_ANON_KEY!` with non-null assertion while client/middleware used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. | Unified credential retrieval in `server.ts`, `client.ts`, and `middleware.ts` with fallback support for both keys and safe development fallbacks. | Production build compiles with zero runtime errors when building static pages. |
| **FIX-04** | Invalid Next.js remotePatterns hostname | Medium | `next.config.ts` had `hostname: "https://gttrrgwbxuijcenagaha.supabase.co"`, which violates Next.js protocolless hostname schema. | Corrected hostname to `gttrrgwbxuijcenagaha.supabase.co` and added wildcard `*.supabase.co`. | Production build trace passed with zero remote pattern warnings. |
| **FIX-05** | Broken ESLint configuration (`eslint .` failed) | High | ESLint 9 requires flat config (`eslint.config.mjs`). No config file was present. | Created `eslint.config.mjs` extending `next/core-web-vitals` with proper ignore paths (`.next/**`, `node_modules/**`). | `npm run lint` exits with code 0 (0 errors, 0 warnings). |
| **FIX-06** | Duplicate header and footer rendering | High | `app/page.tsx` contained its own header and footer elements while `app/layout.tsx` also rendered topbar and footer. | Extracted universal `Navbar` and `Footer` components into `app/layout.tsx`, removed duplicated wrappers from `app/page.tsx`. | HTTP response inspection verified exactly 1 `<header>` and 1 `<footer>` tag on `/`. |
| **FIX-07** | Broken Tailwind classes & styling disconnection | High | `app/page.tsx` used uncompiled Tailwind utility classes (`min-h-screen bg-[#10110f]`, etc.) while Tailwind was not installed; other routes used old unstyled CSS. | Rebuilt complete Framer-inspired design system in `app/globals.css` with dark obsidian palette, gold accents, and responsive layout classes. | Verified via browser testing and responsive CSS inspections. |
| **FIX-08** | Unsafe `useSearchParams` in client component | Medium | `app/login/page.tsx` accessed `useSearchParams()` without a `<Suspense>` wrapper, causing Next.js App Router client bailout. | Extracted `LoginForm` into a `<Suspense>` boundary with custom loading fallback. | Production build static generation succeeded with zero bailout errors. |
| **FIX-09** | Missing real-time updates for live auctions | High | Database schema configured realtime publication for `auctions` and `bids`, but frontend had no subscription. | Implemented client-side Supabase Realtime channel subscription in `AuctionLiveView` listening to `INSERT` on `bids` and `UPDATE` on `auctions`. | Tested and verified live update state logic. |
| **FIX-10** | Absence of automated test suite | Medium | `package.json` had no `test` script; no regression testing existed. | Added Node 24 native test runner suite in `tests/auction.test.ts` covering currency formatting, status calculations, bid validation, and redirect safety. | `npm test` runs 17 unit tests in 111ms, passing 100%. |
| **FIX-11** | Open redirect vulnerability in OAuth callback | High | Callback route checked relative URL with basic prefix check that could be bypassed by protocol-relative URLs (`//evil.com`). | Implemented `getSafeRedirect()` strictly allowing only internal relative paths and rejecting scheme-based redirects. | Verified via unit tests in `tests/auction.test.ts`. |
| **FIX-12** | TypeScript `any` types and unused variables | Low | `(b: any)` used in `akun/page.tsx` and `lelang/[id]/page.tsx`, unused `data` in `bid-form.tsx`. | Created strongly typed interfaces (`UserBid`, `BidRecord`, `RawBidData`), removed unused variables. | `tsc --noEmit` and `npm run lint` exit cleanly with 0 errors and 0 warnings. |

---

## 2. Regression Testing Summary

| Test Suite | Tests Run | Result | Execution Time |
|---|---|---|---|
| Money formatting (`rupiah`) | 4 tests | Passed | 16.5ms |
| Auction State transitions | 4 tests | Passed | 1.1ms |
| Bid calculations and validation | 5 tests | Passed | 0.8ms |
| Time remaining countdowns | 2 tests | Passed | 0.3ms |
| Safe redirect URI verification | 2 tests | Passed | 0.2ms |
| **Total Unit Tests** | **17 tests** | **100% Passed** | **111.9ms** |
| **TypeScript Typecheck (`tsc --noEmit`)** | Whole codebase | **0 errors** | ~14s |
| **ESLint (`npm run lint`)** | Whole codebase | **0 errors, 0 warnings** | ~4s |
| **Next.js Production Build (`next build`)** | All 8 routes | **0 errors, code 0** | ~1.7s |
