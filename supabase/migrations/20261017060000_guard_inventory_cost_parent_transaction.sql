begin;

-- Protect inventory-cost records through both their direct auction_id and
-- their parent finance transaction. The two relationships must not create a
-- gap if data is inconsistent or an inventory row is reassigned.
create or replace function public.reject_finance_changes_for_archived_auction()
returns trigger
language plpgsql
security definer
set search_path to ''
as $archive_guard$
declare
  v_auction_id uuid;
  v_related_auction_id uuid;
  v_ids uuid[];
  v_archived_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_ids := array[old.auction_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[old.auction_id, new.auction_id];
  else
    v_ids := array[new.auction_id];
  end if;

  if tg_table_name in ('finance_journal_lines', 'finance_inventory_costs') then
    if tg_op <> 'INSERT' then
      select t.auction_id into v_related_auction_id
      from public.finance_transactions t
      where t.id = old.transaction_id;
      v_ids := array_append(v_ids, v_related_auction_id);
    end if;

    if tg_op <> 'DELETE' then
      select t.auction_id into v_related_auction_id
      from public.finance_transactions t
      where t.id = new.transaction_id;
      v_ids := array_append(v_ids, v_related_auction_id);
    end if;
  end if;

  for v_auction_id in
    select distinct candidate_id
    from unnest(v_ids) as candidates(candidate_id)
    where candidate_id is not null
    order by candidate_id
  loop
    select a.archived_at
      into v_archived_at
      from public.auctions a
      where a.id = v_auction_id
      for share;

    if v_archived_at is not null then
      raise exception 'Lot sudah diarsipkan. Riwayat keuangan lot ini tidak dapat diubah atau dihapus.';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$archive_guard$;

revoke all on function public.reject_finance_changes_for_archived_auction() from public, anon, authenticated;

-- Align the atomic RPC count with the admin preview. Count an inventory cost
-- if it references the auction directly OR its parent transaction belongs to it.
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

  -- Avoid child-row locks here: receipt processing locks a sale row before
  -- its finance trigger locks the auction. The auction FOR UPDATE lock
  -- serializes archive against finance triggers taking FOR SHARE on the lot.

  select jsonb_build_object(
    'bids', (select count(*) from public.bids where auction_id = p_auction_id),
    'results', (select case when winner_bidder_id is not null then 1 else 0 end from public.auctions where id = p_auction_id),
    'transactions', (select count(*) from public.finance_transactions where auction_id = p_auction_id),
    'journalLines', (
      select count(*)
      from public.finance_journal_lines j
      where j.auction_id = p_auction_id
         or j.transaction_id in (
           select t.id from public.finance_transactions t where t.auction_id = p_auction_id
         )
    ),
    'inventoryCosts', (
      select count(*)
      from public.finance_inventory_costs c
      where c.auction_id = p_auction_id
         or c.transaction_id in (
           select t.id from public.finance_transactions t where t.auction_id = p_auction_id
         )
    )
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

  perform pg_catalog.set_config('tmdwar.archive_rpc', 'on', true);

  update public.auctions
  set archived_at = clock_timestamp(),
      archived_by = auth.uid(),
      archive_reason = btrim(p_reason),
      status = v_next_status,
      updated_at = clock_timestamp()
  where id = p_auction_id
    and archived_at is null;

  perform pg_catalog.set_config('tmdwar.archive_rpc', 'off', true);

  return jsonb_build_object('status', v_next_status, 'counts', v_counts);
end;
$archive_function$;

revoke all on function public.archive_auction(uuid, text, text, jsonb) from public, anon;
grant execute on function public.archive_auction(uuid, text, text, jsonb) to authenticated;

commit;
