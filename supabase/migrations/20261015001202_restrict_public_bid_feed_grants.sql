begin;

-- Views inherit permissive default table grants in some Supabase configurations.
-- Keep the public feed strictly read-only.
revoke all privileges on table public.public_bid_feed from public, anon, authenticated;
grant select on table public.public_bid_feed to anon, authenticated;

-- Accepted bids must be written only through the validated place_bid RPC.
revoke insert, update, delete, truncate, references, trigger
  on table public.bids from anon, authenticated;

commit;
