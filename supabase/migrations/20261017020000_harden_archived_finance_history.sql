begin;

-- Harden the archive boundary for every financial history table. This also closes
-- races with archive_auction by taking a row SHARE lock on each referenced auction.
create or replace function public.reject_finance_changes_for_archived_auction()
returns trigger
language plpgsql
security definer
set search_path to ''
as $archive_guard$
declare
  v_auction_id uuid;
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

  -- Deterministic lock ordering avoids deadlocks when a row is reassigned between lots.
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

-- Transactions, inventory-cost records, and journal lines are protected consistently.
drop trigger if exists reject_finance_changes_for_archived_auction on public.finance_transactions;
create trigger reject_finance_changes_for_archived_auction
  before insert or update or delete on public.finance_transactions
  for each row execute function public.reject_finance_changes_for_archived_auction();

drop trigger if exists reject_finance_changes_for_archived_auction on public.finance_inventory_costs;
create trigger reject_finance_changes_for_archived_auction
  before insert or update or delete on public.finance_inventory_costs
  for each row execute function public.reject_finance_changes_for_archived_auction();

drop trigger if exists reject_finance_changes_for_archived_auction on public.finance_journal_lines;
create trigger reject_finance_changes_for_archived_auction
  before insert or update or delete on public.finance_journal_lines
  for each row execute function public.reject_finance_changes_for_archived_auction();

commit;
