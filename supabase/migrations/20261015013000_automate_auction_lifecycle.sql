begin;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.process_auction_schedule()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_activated integer := 0;
  v_ended integer := 0;
begin
  -- Activate scheduled auctions only inside their configured time window.
  update public.auctions
    set status = 'live',
        updated_at = clock_timestamp()
    where status = 'scheduled'
      and starts_at <= clock_timestamp()
      and ends_at > clock_timestamp();
  get diagnostics v_activated = row_count;

  -- Close expired scheduled/live auctions and persist a deterministic winner.
  with expired as (
    select
      a.id,
      (
        select b.bidder_id
        from public.bids b
        where b.auction_id = a.id
        order by b.amount desc, b.created_at asc, b.id asc
        limit 1
      ) as winner_id
    from public.auctions a
    where a.status in ('scheduled', 'live')
      and a.ends_at <= clock_timestamp()
    for update skip locked
  )
  update public.auctions a
    set status = 'ended',
        winner_bidder_id = expired.winner_id,
        ended_at = coalesce(a.ended_at, clock_timestamp()),
        updated_at = clock_timestamp()
    from expired
    where a.id = expired.id;
  get diagnostics v_ended = row_count;

  return jsonb_build_object(
    'activated', v_activated,
    'ended', v_ended,
    'processed_at', clock_timestamp()
  );
end;
$function$;

revoke all on function public.process_auction_schedule() from public, anon, authenticated;
grant execute on function public.process_auction_schedule() to service_role;

do $block$
begin
  if not exists (
    select 1 from cron.job where jobname = 'tmdwar-auction-lifecycle'
  ) then
    perform cron.schedule(
      'tmdwar-auction-lifecycle',
      '* * * * *',
      'select public.process_auction_schedule();'
    );
  end if;
end;
$block$;

commit;
