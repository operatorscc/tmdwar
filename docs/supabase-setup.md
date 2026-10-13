# TMD-WAR — Supabase Database Setup & Integration Guide

**Database System:** Supabase PostgreSQL  
**Authentication:** Supabase Auth (Facebook OAuth)  
**Real-Time Engine:** Supabase Realtime (WebSockets)  
**Security Model:** Row-Level Security (RLS) & Atomic RPC (`place_bid`)  

---

## 1. Overview of Database Schema

The database consists of three primary application tables, strict enum constraints, custom indexes, and row-level locking stored procedures:

```
auth.users (Supabase Managed)
    │
    │ 1:1 on delete cascade
    ▼
public.profiles
    │
    ├─ 1:N (created_by) ──► public.auctions
    │                            │
    └─ 1:N (bidder_id) ──────────┼─ 1:N (auction_id)
                                 ▼
                           public.bids
```

### Table Specifications

#### 1. `public.profiles`
- **Purpose:** Synchronizes application profiles with Supabase `auth.users` upon signup.
- **Columns:**
  - `id` (`uuid`, Primary Key): References `auth.users(id)` ON DELETE CASCADE.
  - `display_name` (`text`): User full name or pseudonym from OAuth metadata.
  - `avatar_url` (`text`): Profile picture URL from OAuth.
  - `role` (`public.user_role` NOT NULL, default `'bidder'`): User role (`'bidder'` or `'admin'`).
  - `created_at` (`timestamptz` NOT NULL, default `now()`).
  - `updated_at` (`timestamptz` NOT NULL, default `now()`).

#### 2. `public.auctions`
- **Purpose:** Stores curated lots for public auctioning.
- **Columns:**
  - `id` (`uuid`, Primary Key, default `gen_random_uuid()`).
  - `title` (`text` NOT NULL, CHECK length between 3 and 160).
  - `description` (`text`): Lot condition, provenance, and specifications.
  - `image_url` (`text`): Storage URL of high-resolution asset.
  - `auction_mode` (`public.auction_mode` NOT NULL, default `'timed'`): `'timed'` or `'live'`.
  - `status` (`public.auction_status` NOT NULL, default `'draft'`): `'draft'`, `'scheduled'`, `'live'`, `'ended'`, `'cancelled'`.
  - `starting_price` (`bigint` NOT NULL, CHECK `>= 0`).
  - `current_price` (`bigint` NOT NULL, CHECK `>= starting_price`).
  - `min_increment` (`bigint` NOT NULL, CHECK `> 0`).
  - `starts_at` (`timestamptz` NOT NULL).
  - `ends_at` (`timestamptz` NOT NULL, CHECK `ends_at > starts_at`).
  - `created_by` (`uuid` NOT NULL): References `public.profiles(id)`.
  - `created_at` (`timestamptz` NOT NULL, default `now()`).
  - `updated_at` (`timestamptz` NOT NULL, default `now()`).
- **Indexes:**
  - `auctions_public_idx (status, ends_at)`
  - `auctions_created_by_idx (created_by)`
  - `auctions_created_at_idx (created_at desc)`

#### 3. `public.bids`
- **Purpose:** Immutable ledger of validated bids accepted through `place_bid`.
- **Columns:**
  - `id` (`bigint generated always as identity`, Primary Key).
  - `auction_id` (`uuid` NOT NULL): References `public.auctions(id)` ON DELETE RESTRICT.
  - `bidder_id` (`uuid` NOT NULL): References `public.profiles(id)` ON DELETE RESTRICT.
  - `amount` (`bigint` NOT NULL, CHECK `amount > 0`).
  - `created_at` (`timestamptz` NOT NULL, default `now()`).
- **Indexes:**
  - `bids_auction_amount_idx (auction_id, amount desc, created_at)`
  - `bids_bidder_created_idx (bidder_id, created_at desc)`

---

## 2. Row Level Security (RLS) & Mutation Boundaries

To prevent unauthorized tampering or bypass of auction rules, direct mutations from client APIs are strictly locked down:

| Table | Operation | Allowed Roles | Policy Logic |
|---|---|---|---|
| `profiles` | SELECT | `authenticated` | Accessible to logged-in users. |
| `profiles` | UPDATE | `authenticated` | Users can update their own `display_name` / `avatar_url`, but **cannot** alter `role`. |
| `auctions` | SELECT | `anon`, `authenticated` | Can view items where `status IN ('scheduled', 'live', 'ended')` OR caller is admin. |
| `auctions` | INSERT | `authenticated` | Admin only: `public.is_admin() AND created_by = auth.uid()`. |
| `auctions` | UPDATE | `authenticated` | Admin only: `public.is_admin()`. |
| `auctions` | DELETE | `authenticated` | Admin only: `public.is_admin() AND status = 'draft'`. |
| `bids` | SELECT | `anon`, `authenticated` | Public transparency: anyone can read bid history. |
| `bids` | INSERT / UPDATE / DELETE | **REVOKED** | Direct table mutations by clients are forbidden. |

### The Atomic `place_bid` Stored Procedure
Bid submission is only permitted through the database RPC function `place_bid(p_auction_id, p_amount)`.
- **Row-Level Lock:** Executes `SELECT * FROM public.auctions WHERE id = p_auction_id FOR UPDATE;`
- **Concurrency Isolation:** If multiple bids hit the database in the exact same millisecond, the lock serializes execution. The second transaction re-evaluates `current_price` and rejects any bid that does not exceed the new threshold.
- **Role Boundary:** Admins are explicitly prohibited from placing bids (`raise exception 'Akun admin tidak dapat ikut menawar.'`).
- **Time Window:** Validates `starts_at <= clock_timestamp() < ends_at`.

---

## 3. Migration Setup with Supabase CLI

Migrations are version-controlled in [`supabase/migrations/`](file:///d:/g0nz/PRIVATE/HOME%20SERVER/BID%20WAR%20TMD/av/tmdwar/supabase/migrations):
- `supabase/migrations/20261013000000_initial_schema.sql`

### 3.1 Initializing & Linking Supabase Project

1. Log in to Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Link your local repository to your remote Supabase project:
   ```bash
   npx supabase link --project-ref <PROJECT-REF>
   ```
   *(Example Project Ref: `gttrrgwbxuijcenagaha` or your own cloud project ID)*.

3. Push migrations to the remote database:
   ```bash
   npx supabase db push
   ```

### 3.2 Running Migrations via Supabase Dashboard (Manual Alternative)
If Supabase CLI linking is unavailable:
1. Open **Supabase Dashboard → Project → SQL Editor**.
2. Open [`supabase/migrations/20261013000000_initial_schema.sql`](file:///d:/g0nz/PRIVATE/HOME%20SERVER/BID%20WAR%20TMD/av/tmdwar/supabase/migrations/20261013000000_initial_schema.sql).
3. Paste the contents into the SQL Editor and click **Run**.
4. Verify all tables, RLS policies, and triggers are created.

### 3.3 Seeding Development Data
To seed realistic, non-sensitive mock lots for development:
```bash
npx supabase db reset --seed
```
Or paste the contents of [`supabase/seed.sql`](file:///d:/g0nz/PRIVATE/HOME%20SERVER/BID%20WAR%20TMD/av/tmdwar/supabase/seed.sql) into the Supabase Dashboard SQL Editor.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env.local`:
```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# Linux / macOS
cp .env.example .env.local
```

### Required Variables:
- `NEXT_PUBLIC_SUPABASE_URL`: The project URL (e.g. `https://<PROJECT-REF>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public/anon key found in Project Settings > API.
- `NEXT_PUBLIC_SITE_URL`: Base application origin (e.g. `http://localhost:3000` for local or `https://your-domain.vercel.app` for production).
- `SUPABASE_SERVICE_ROLE_KEY` *(Optional / Server-Only)*: Never expose to browser or commit to git.

---

## 5. Authentication & OAuth Configuration (Facebook)

1. **Meta Developer Console:**
   - Go to [Meta for Developers](https://developers.facebook.com/) > My Apps.
   - Add **Facebook Login (Web)**.
   - In Facebook Login Settings, set **Valid OAuth Redirect URI**:
     `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard Authentication:**
   - Go to **Authentication → Providers → Facebook**.
   - Enable Facebook provider, input **App ID** and **App Secret**.
3. **Redirect URL Allow-list:**
   - Go to **Authentication → URL Configuration**.
   - Set **Site URL** to `http://localhost:3000` (or production domain).
   - Add `http://localhost:3000/auth/callback` and `https://<YOUR-DOMAIN>/auth/callback` to **Redirect URLs**.

---

## 6. Recovery & Rollback Procedures

### Rollback Strategy
If an issue occurs with a newly deployed migration:
1. Every migration is versioned and additive where possible.
2. In the event of an emergency schema recovery:
   - Identify the affected object.
   - Write a backward-compatible down migration (e.g., `ALTER TABLE ... DROP COLUMN IF EXISTS`).
   - Do NOT drop tables containing historical bid records.
3. Database Backups:
   - In Supabase Dashboard, daily automated backups are maintained under **Database → Backups**.
   - Point-in-time recovery (PITR) is available on Pro tier projects.
