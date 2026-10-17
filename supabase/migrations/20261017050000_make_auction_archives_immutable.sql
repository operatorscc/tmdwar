begin;

-- Replace the archive RPC so the immutable-archive trigger can distinguish
-- a validated archive operation from a direct table update.
-- Keep archive preview and the atomic database check aligned. A journal line is affected
-- if it links directly to the auction OR through its parent finance transaction.
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
    'results', (select count(*) from public.auction_results where auction_id = p_auction_id),
    'transactions', (select count(*) from public.finance_transactions where auction_id = p_auction_id),
    'journalLines', (
      select count(*)
      from public.finance_journal_lines j
      where j.auction_id = p_auction_id
         or j.transaction_id in (
           select t.id
           from public.finance_transactions t
           where t.auction_id = p_auction_id
         )
    ),
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

  -- Mark this transaction so the database guard accepts only this RPC's archive transition.
  perform pg_catalog.set_config('tmdwar.archive_rpc', 'on', true);

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


-- Prevent direct edits, manual unarchive, or forged archive metadata via table UPDATE.
-- Only archive_auction sets this transaction-local flag after admin/title/count checks.
create or replace function public.guard_auction_archive_transition()
returns trigger
language plpgsql
security definer
set search_path to ''
as $archive_transition$
begin
  if tg_op = 'INSERT' then
    if new.archived_at is not null
       or new.archived_by is not null
       or new.archive_reason is not null then
      raise exception 'Lelang hanya dapat diarsipkan melalui prosedur arsip admin.';
    end if;
    return new;
  end if;

  if old.archived_at is not null then
    raise exception 'Lelang yang sudah diarsipkan bersifat permanen dan tidak dapat diubah atau dipulihkan.';
  end if;

  if new.archived_at is not null then
    if pg_catalog.current_setting('tmdwar.archive_rpc', true) is distinct from 'on' then
      raise exception 'Pengarsipan harus dilakukan melalui prosedur arsip admin.';
    end if;
    if new.archived_by is distinct from auth.uid()
       or nullif(btrim(new.archive_reason), '') is null then
      raise exception 'Metadata pengarsipan tidak valid.';
    end if;
  end if;

  return new;
end;
$archive_transition$;

revoke all on function public.guard_auction_archive_transition() from public, anon, authenticated;

drop trigger if exists guard_auction_archive_transition on public.auctions;
create trigger guard_auction_archive_transition
  before insert or update on public.auctions
  for each row execute function public.guard_auction_archive_transition();


commit;
