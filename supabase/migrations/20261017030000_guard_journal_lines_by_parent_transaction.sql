begin;

-- Journal lines are linked to their parent finance transaction as well as carrying
-- an optional auction_id. Protect both relationships so a journal line cannot be
-- changed by nulling/misassigning auction_id while its parent transaction belongs
-- to an archived auction.
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

  if tg_table_name = 'finance_journal_lines' then
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

  -- Lock all relevant auctions in a deterministic order. This includes both
  -- the line's own auction_id and the auction referenced by its parent transaction.
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

revoke all on function public.reject_finance_changes_for_archived_auction() from public;
revoke all on function public.reject_finance_changes_for_archived_auction() from anon, authenticated;

commit;
