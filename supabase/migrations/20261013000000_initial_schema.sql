-- =============================================================================
-- Migration: 20261013000000_initial_schema.sql
-- Description: Core schema, RLS policies, triggers, and atomic place_bid RPC
-- Target: Supabase PostgreSQL
-- =============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- 2. CUSTOM TYPES
do $$ begin
  create type public.user_role as enum ('bidder', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.auction_mode as enum ('timed', 'live');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.auction_status as enum ('draft', 'scheduled', 'live', 'ended', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- 3. TABLES

-- Profiles: synchronized with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'bidder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auctions: items curated for bidding
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text,
  image_url text,
  auction_mode public.auction_mode not null default 'timed',
  status public.auction_status not null default 'draft',
  starting_price bigint not null check (starting_price >= 0),
  current_price bigint not null check (current_price >= 0),
  min_increment bigint not null check (min_increment > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (current_price >= starting_price)
);

-- Bids: immutable log of accepted bids
create table if not exists public.bids (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.auctions(id) on delete restrict,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- 4. INDEXES
create index if not exists auctions_public_idx on public.auctions(status, ends_at);
create index if not exists auctions_created_by_idx on public.auctions(created_by);
create index if not exists auctions_created_at_idx on public.auctions(created_at desc);
create index if not exists bids_auction_amount_idx on public.bids(auction_id, amount desc, created_at);
create index if not exists bids_bidder_created_idx on public.bids(bidder_id, created_at desc);

-- 5. FUNCTIONS & TRIGGERS

-- Trigger to create/update profile on auth signup. Role is strictly forced to bidder.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'bidder'
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper to safely evaluate whether the caller holds the admin role
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- 6. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;

-- Profiles Policies
drop policy if exists "Profiles are readable to authenticated users" on public.profiles;
create policy "Profiles are readable to authenticated users"
on public.profiles for select to authenticated
using (true);

drop policy if exists "Users can update their own non-role profile fields" on public.profiles;
create policy "Users can update their own non-role profile fields"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid()) and
  role = (select p.role from public.profiles p where p.id = (select auth.uid()))
);

-- Auctions Policies
drop policy if exists "Public can read published auctions" on public.auctions;
create policy "Public can read published auctions"
on public.auctions for select to anon, authenticated
using (status in ('scheduled', 'live', 'ended') or public.is_admin());

drop policy if exists "Admins can insert auctions" on public.auctions;
create policy "Admins can insert auctions"
on public.auctions for insert to authenticated
with check (public.is_admin() and created_by = (select auth.uid()));

drop policy if exists "Admins can update auctions" on public.auctions;
create policy "Admins can update auctions"
on public.auctions for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete draft auctions" on public.auctions;
create policy "Admins can delete draft auctions"
on public.auctions for delete to authenticated
using (public.is_admin() and status = 'draft');

-- Bids Policies: Public can read bid log; direct mutations from clients forbidden
drop policy if exists "Public can read bids" on public.bids;
create policy "Public can read bids"
on public.bids for select to anon, authenticated
using (true);

-- 7. ATOMIC PLACE_BID STORED PROCEDURE (ROW-LEVEL LOCKING)
create or replace function public.place_bid(p_auction_id uuid, p_amount bigint)
returns table (bid_id bigint, accepted_amount bigint, new_current_price bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_auction public.auctions%rowtype;
  v_bid_id bigint;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception 'Login diperlukan untuk menawar.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal penawaran tidak valid.';
  end if;

  -- Lock the target auction row to serialize concurrent bids
  select * into v_auction from public.auctions
    where id = p_auction_id for update;

  if not found then
    raise exception 'Lelang tidak ditemukan.';
  end if;

  if v_auction.status <> 'live' then
    raise exception 'Lelang tidak sedang berlangsung.';
  end if;

  if v_now < v_auction.starts_at then
    raise exception 'Lelang belum dimulai.';
  end if;

  if v_now >= v_auction.ends_at then
    raise exception 'Waktu lelang telah berakhir.';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    raise exception 'Akun admin tidak dapat ikut menawar.';
  end if;

  if p_amount < v_auction.current_price + v_auction.min_increment then
    raise exception 'Bid minimum adalah %.', v_auction.current_price + v_auction.min_increment;
  end if;

  -- Insert the validated bid record
  insert into public.bids (auction_id, bidder_id, amount)
    values (p_auction_id, v_uid, p_amount)
    returning id into v_bid_id;

  -- Update auction's current price
  update public.auctions
    set current_price = p_amount, updated_at = v_now
    where id = p_auction_id;

  return query select v_bid_id, p_amount, p_amount;
end;
$$;

-- 8. PERMISSIONS & GRANTS
revoke all on function public.place_bid(uuid, bigint) from public;
grant execute on function public.place_bid(uuid, bigint) to authenticated;

revoke insert, update, delete on public.bids from anon, authenticated;
grant select on public.bids to anon, authenticated;
grant select on public.auctions to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant select, update on public.profiles to authenticated;

-- 9. REALTIME PUBLICATIONS
do $$ begin
  alter publication supabase_realtime add table public.bids;
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.auctions;
exception
  when duplicate_object then null;
end $$;
