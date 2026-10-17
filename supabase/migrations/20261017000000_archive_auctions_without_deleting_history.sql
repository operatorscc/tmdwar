begin;

-- Archive metadata only. Child records are deliberately retained.
alter table public.auctions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

create index if not exists auctions_archived_at_idx
  on public.auctions (archived_at, created_at desc);

do $archive_constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'auctions_archive_metadata_check'
      and conrelid = 'public.auctions'::regclass
  ) then
    alter table public.auctions
      add constraint auctions_archive_metadata_check
      check (
        archived_at is null
        or (
          archived_by is not null
          and nullif(btrim(archive_reason), '') is not null
          and status not in ('scheduled', 'live')
        )
      );
  end if;
end
$archive_constraint$;

-- Archiving replaces permanent deletion: remove the old RLS delete policy and table privilege.
drop policy if exists "Admins can delete removable auctions" on public.auctions;
revoke delete on table public.auctions from anon, authenticated;

-- Public users cannot read archived lots, while admins retain access to manage the archive.
drop policy if exists "Public can read published auctions" on public.auctions;
create policy "Public can read published auctions"
  on public.auctions for select to anon, authenticated
  using (
    (archived_at is null and status in ('scheduled', 'live', 'ended'))
    or public.is_admin()
  );

-- The public bid-feed view bypasses underlying RLS by design, so explicitly hide archived lots here too.
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
where a.archived_at is null
  and a.status in ('scheduled', 'live', 'ended');

grant select on public.public_bid_feed to anon, authenticated;


-- Archive atomically with the preview confirmed by the administrator.
-- Locking the auction row serializes this operation against place_bid.
create or replace function public.archive_auction(
  p_auction_id uuid,
  p_confirm_title text,
  p_reason text,
  p_expected_counts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $archive_function$
declare
  v_auction public.auctions%rowtype;
  v_counts jsonb;
  v_next_status public.auction_status;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengarsipkan lelang.';
  end if;

  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 1000 then
    raise exception 'Alasan arsip wajib diisi dan maksimal 1.000 karakter.';
  end if;

  if p_expected_counts is null or jsonb_typeof(p_expected_counts) <> 'object' then
    raise exception 'Pratinjau dampak arsip tidak valid.';
  end if;

  select *
    into v_auction
    from public.auctions
    where id = p_auction_id
    for update;

  if not found then
    raise exception 'Lelang tidak ditemukan.';
  end if;
  if v_auction.archived_at is not null then
    raise exception 'Lelang sudah diarsipkan.';
  end if;
  if v_auction.title is distinct from p_confirm_title then
    raise exception 'Nama lelang berubah sejak konfirmasi. Muat ulang dan periksa kembali dampaknya.';
  end if;

  -- Do not lock finance_transactions rows here: receipt processing locks a sale row
  -- before its finance trigger locks the auction, so taking row locks in the reverse
  -- order can deadlock. The finance-history triggers take FOR SHARE on this auction.
  -- This FOR UPDATE lock therefore serializes archive against financial writes without
  -- acquiring child-row locks in the opposite order: an in-flight write finishes first,
  -- or it wakes after archive and is rejected by the archived-auction guard.

  select jsonb_build_object(
    'bids', (select count(*) from public.bids where auction_id = p_auction_id),
    'results', (select case when winner_bidder_id is not null then 1 else 0 end from public.auctions where id = p_auction_id),
    'transactions', (select count(*) from public.finance_transactions where auction_id = p_auction_id),
    'journalLines', (select count(*) from public.finance_journal_lines where auction_id = p_auction_id),
    'inventoryCosts', (select count(*) from public.finance_inventory_costs where auction_id = p_auction_id)
  )
  into v_counts;

  if jsonb_build_object(
    'bids', p_expected_counts -> 'bids',
    'results', p_expected_counts -> 'results',
    'transactions', p_expected_counts -> 'transactions',
    'journalLines', p_expected_counts -> 'journalLines',
    'inventoryCosts', p_expected_counts -> 'inventoryCosts'
  ) is distinct from v_counts then
    raise exception 'Data lelang berubah sejak pratinjau. Arsip dibatalkan; muat ulang dan konfirmasi dampak terbaru.';
  end if;

  v_next_status := case
    when v_auction.status in ('scheduled'::public.auction_status, 'live'::public.auction_status)
      then 'cancelled'::public.auction_status
    else v_auction.status
  end;

  update public.auctions
  set archived_at = clock_timestamp(),
      archived_by = auth.uid(),
      archive_reason = btrim(p_reason),
      status = v_next_status,
      updated_at = clock_timestamp()
  where id = p_auction_id
    and archived_at is null;

  return jsonb_build_object('status', v_next_status, 'counts', v_counts);
end;
$archive_function$;

revoke all on function public.archive_auction(uuid, text, text, jsonb) from public;
revoke all on function public.archive_auction(uuid, text, text, jsonb) from anon;
grant execute on function public.archive_auction(uuid, text, text, jsonb) to authenticated;

-- Never delete bids, results, transactions, journal lines, or inventory costs via archiving.
-- RLS update permission remains restricted to admins by the existing policy.
commit;
