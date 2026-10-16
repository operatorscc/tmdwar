-- TMD-WAR starter schema
-- Run in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create type public.user_role as enum ('bidder','admin');
create type public.auction_mode as enum ('timed','live');
create type public.auction_status as enum ('draft','scheduled','live','ended','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'bidder',
  created_at timestamptz not null default now()
);

create table public.auctions (
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
create index auctions_public_idx on public.auctions(status, ends_at);
create index auctions_created_by_idx on public.auctions(created_by);

create table public.bids (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.auctions(id) on delete restrict,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index bids_auction_amount_idx on public.bids(auction_id, amount desc, created_at);
create index bids_bidder_created_idx on public.bids(bidder_id, created_at desc);

-- Create/update profile on OAuth signup. Role is always forced to bidder.
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
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;

-- Profiles are private by default; admins can read profiles for administration.
create policy "Users can read own profile or admins all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
-- Public can view published auctions. Admin can view all, including drafts.
create policy "Public can read published auctions"
on public.auctions for select to anon, authenticated
using (status in ('scheduled','live','ended') or public.is_admin());
create policy "Admins can insert auctions"
on public.auctions for insert to authenticated
with check (public.is_admin() and created_by = (select auth.uid()));
create policy "Admins can update auctions"
on public.auctions for update to authenticated
using (public.is_admin()) with check (public.is_admin());
-- Keep the baseline schema aligned with the safe-delete migration.
-- Only unreferenced draft, ended, or cancelled auctions may be deleted.
-- Foreign-key RESTRICT constraints preserve any auction with bid history.
create policy "Admins can delete removable auctions"
on public.auctions for delete to authenticated
using (
  public.is_admin()
  and status in ('draft', 'ended', 'cancelled')
);

-- Raw bids contain bidder UUIDs. Only a bidder's own rows and admins are
-- readable directly; public history is served through the anonymized view.
create policy "Users can read own bids or admins all"
on public.bids for select to authenticated
using (bidder_id = (select auth.uid()) or (select public.is_admin()));

create or replace view public.public_bid_feed
with (security_invoker = false)
as
select
  b.id,
  b.auction_id,
  b.amount,
  b.created_at,
  'Peserta #' || dense_rank() over (
    partition by b.auction_id
    order by b.bidder_id
  )::text as bidder_name
from public.bids b
join public.auctions a on a.id = b.auction_id
where a.status in ('scheduled', 'live', 'ended');

-- Bid submission is only through this transaction. Row lock serializes competing bids.
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
  if v_uid is null then raise exception 'Login diperlukan untuk menawar.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal penawaran tidak valid.'; end if;

  select * into v_auction from public.auctions
    where id = p_auction_id for update;
  if not found then raise exception 'Lelang tidak ditemukan.'; end if;
  if v_auction.status <> 'live' then raise exception 'Lelang tidak sedang berlangsung.'; end if;
  if v_now < v_auction.starts_at then raise exception 'Lelang belum dimulai.'; end if;
  if v_now >= v_auction.ends_at then raise exception 'Waktu lelang telah berakhir.'; end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    raise exception 'Akun admin tidak dapat ikut menawar.';
  end if;
  if p_amount < v_auction.current_price + v_auction.min_increment then
    raise exception 'Bid minimum adalah %.', v_auction.current_price + v_auction.min_increment;
  end if;

  insert into public.bids (auction_id, bidder_id, amount)
    values (p_auction_id, v_uid, p_amount)
    returning id into v_bid_id;

  update public.auctions set current_price = p_amount, updated_at = v_now
    where id = p_auction_id;

  return query select v_bid_id, p_amount, p_amount;
end;
$$;
revoke all on function public.place_bid(uuid,bigint) from public;
grant execute on function public.place_bid(uuid,bigint) to authenticated;

-- Keep table mutation privileges explicit and narrow.
revoke insert, update, delete on public.bids from anon, authenticated;
revoke select on public.bids from anon;
grant select on public.bids to authenticated;
grant select on public.public_bid_feed to anon, authenticated;
grant select on public.auctions to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant select on public.profiles to authenticated;

-- Enable realtime for bid history/current auction changes.
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.auctions;

-- After signing in with your own Facebook account, find its UUID in auth.users
-- and run this once to grant admin privileges (replace UUID):
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
