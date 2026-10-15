begin;

-- Remove unrestricted access to all bidder records.
drop policy if exists "Public can read bids" on public.bids;
drop policy if exists "Users can read own bids or admins all" on public.bids;
create policy "Users can read own bids or admins all"
  on public.bids
  for select
  to authenticated
  using (
    bidder_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Profiles are private by default. Users can read their own profile;
-- administrators can read profiles for legitimate administration.
drop policy if exists "Profiles are readable to authenticated users" on public.profiles;
drop policy if exists "Users can read own profile or admins all" on public.profiles;
create policy "Users can read own profile or admins all"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  );

-- Expose public bid history without exposing bidder UUIDs or profile data.
-- The stable pseudonym is scoped to a single auction.
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

grant select on public.public_bid_feed to anon, authenticated;

commit;
