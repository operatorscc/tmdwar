begin;

-- Archived auction history is retained, but finance transactions tied to an archived lot
-- must not be created or modified after the archive operation has committed.
-- This trigger is the final database guard for SECURITY DEFINER finance RPCs as well.
create or replace function public.reject_finance_changes_for_archived_auction()
returns trigger
language plpgsql
security definer
set search_path to ''
as $archive_guard$
begin
  if new.auction_id is not null and exists (
    select 1
    from public.auctions a
    where a.id = new.auction_id
      and a.archived_at is not null
  ) then
    raise exception 'Lot sudah diarsipkan. Transaksi keuangan baru atau perubahan transaksi untuk lot ini ditolak.';
  end if;

  return new;
end;
$archive_guard$;

revoke all on function public.reject_finance_changes_for_archived_auction() from public;
revoke all on function public.reject_finance_changes_for_archived_auction() from anon, authenticated;

drop trigger if exists reject_finance_changes_for_archived_auction
  on public.finance_transactions;

create trigger reject_finance_changes_for_archived_auction
  before insert or update on public.finance_transactions
  for each row
  execute function public.reject_finance_changes_for_archived_auction();

commit;
