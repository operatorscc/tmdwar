begin;

-- Exact, read-only archive impact counts are computed in PostgreSQL to avoid
-- PostgREST row-limit truncation and client-side partial counts.
create or replace function public.archive_auction_preview(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $archive_preview$
declare
  v_auction public.auctions%rowtype;
  v_counts jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat melihat pratinjau arsip.';
  end if;

  select *
    into v_auction
    from public.auctions
    where id = p_auction_id;

  if not found then
    raise exception 'Lelang tidak ditemukan.';
  end if;

  if v_auction.archived_at is not null then
    raise exception 'Lelang sudah diarsipkan.';
  end if;

  select jsonb_build_object(
    'bids', (
      select count(*) from public.bids b
      where b.auction_id = p_auction_id
    ),
    'results', (
      select case when a.winner_bidder_id is not null then 1 else 0 end
      from public.auctions a
      where a.id = p_auction_id
    ),
    'transactions', (
      select count(*) from public.finance_transactions t
      where t.auction_id = p_auction_id
    ),
    'journalLines', (
      select count(*) from public.finance_journal_lines j
      where j.auction_id = p_auction_id
         or exists (
           select 1
           from public.finance_transactions t
           where t.id = j.transaction_id
             and t.auction_id = p_auction_id
         )
    ),
    'inventoryCosts', (
      select count(*) from public.finance_inventory_costs c
      where c.auction_id = p_auction_id
         or exists (
           select 1
           from public.finance_transactions t
           where t.id = c.transaction_id
             and t.auction_id = p_auction_id
         )
    )
  )
  into v_counts;

  return jsonb_build_object(
    'title', v_auction.title,
    'status', v_auction.status,
    'counts', v_counts
  );
end;
$archive_preview$;

revoke all on function public.archive_auction_preview(uuid) from public, anon;
grant execute on function public.archive_auction_preview(uuid) to authenticated;

commit;
