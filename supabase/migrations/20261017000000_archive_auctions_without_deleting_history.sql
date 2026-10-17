begin;

-- Archive metadata only. Child records are deliberately retained.
alter table public.auctions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

create index if not exists auctions_archived_at_idx
  on public.auctions (archived_at, created_at desc);

-- Public users cannot read archived lots, while admins retain access to manage the archive.
drop policy if exists "Public can read published auctions" on public.auctions;
create policy "Public can read published auctions"
  on public.auctions for select to anon, authenticated
  using (
    (archived_at is null and status in ('scheduled', 'live', 'ended'))
    or public.is_admin()
  );

-- Never delete bids, results, transactions, journal lines, or inventory costs via archiving.
-- RLS update permission remains restricted to admins by the existing policy.
commit;
