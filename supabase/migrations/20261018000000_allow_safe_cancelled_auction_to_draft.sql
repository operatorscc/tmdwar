-- Allow an unfinalized cancelled auction to return to draft only when it has no
-- bids, official result, or financial history. Ended auctions remain immutable.
CREATE OR REPLACE FUNCTION public.enforce_auction_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_highest_bid bigint;
  v_winner_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  new.winner_bidder_id := null;

  if tg_op = 'INSERT' then
    if new.status in ('ended', 'cancelled') then
      raise exception 'Lot baru hanya boleh berstatus draft, scheduled, atau live.'
        using errcode = '23514';
    end if;
    if new.status = 'live' and not (new.starts_at <= v_now and new.ends_at > v_now) then
      raise exception 'Status live hanya valid selama waktu mulai dan akhir lelang.'
        using errcode = '23514';
    end if;
    if new.status = 'scheduled' and new.ends_at <= v_now then
      raise exception 'Lelang terjadwal harus memiliki waktu akhir di masa depan.'
        using errcode = '23514';
    end if;
    if new.current_price is distinct from new.starting_price then
      raise exception 'Harga saat ini pada lot baru harus sama dengan harga awal.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status in ('ended', 'cancelled') and new.status <> old.status then
    if not (
      old.status = 'cancelled'
      and new.status = 'draft'
      and not exists (select 1 from public.bids b where b.auction_id = old.id)
      and not exists (select 1 from public.auction_results r where r.auction_id = old.id)
      and not exists (select 1 from public.finance_transactions t where t.auction_id = old.id)
      and not exists (select 1 from public.finance_inventory_costs c where c.auction_id = old.id)
      and not exists (select 1 from public.finance_journal_lines j where j.auction_id = old.id)
    ) then
      raise exception 'Lelang berstatus % tidak dapat dibuka kembali atau diubah statusnya. Hanya lelang Dibatalkan tanpa penawaran, hasil resmi, atau catatan keuangan yang dapat dikembalikan ke Draft.', old.status
        using errcode = '23514';
    end if;
  end if;

  select max(b.amount) into v_highest_bid
  from public.bids b where b.auction_id = old.id;

  if v_highest_bid is not null then
    if new.starting_price is distinct from old.starting_price
      or new.min_increment is distinct from old.min_increment
      or new.starts_at is distinct from old.starts_at
      or new.auction_mode is distinct from old.auction_mode then
      raise exception 'Harga awal, kenaikan minimum, waktu mulai, dan mode tidak dapat diubah setelah ada penawaran.'
        using errcode = '23514';
    end if;
    if new.ends_at < old.ends_at then
      raise exception 'Waktu akhir tidak boleh dipercepat setelah ada penawaran.'
        using errcode = '23514';
    end if;
    if new.status = 'scheduled' and old.status = 'live' then
      raise exception 'Lelang live yang sudah menerima penawaran tidak dapat dikembalikan ke status scheduled.'
        using errcode = '23514';
    end if;
    if new.current_price is distinct from v_highest_bid then
      raise exception 'Harga saat ini harus sama dengan penawaran tertinggi yang tercatat (%).', v_highest_bid
        using errcode = '23514';
    end if;
  else
    if new.current_price < new.starting_price then
      raise exception 'Harga saat ini tidak boleh lebih rendah dari harga awal.'
        using errcode = '23514';
    end if;
    if new.current_price is distinct from old.current_price
      and new.current_price is distinct from new.starting_price then
      raise exception 'Tanpa penawaran, harga saat ini hanya boleh disetel ke harga awal.'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'live' and not (new.starts_at <= v_now and new.ends_at > v_now) then
    raise exception 'Status live hanya valid selama waktu mulai dan akhir lelang.'
      using errcode = '23514';
  end if;
  if new.status = 'scheduled' and new.ends_at <= v_now then
    raise exception 'Lelang terjadwal harus memiliki waktu akhir di masa depan.'
      using errcode = '23514';
  end if;

  if new.status = 'ended' and old.status <> 'ended' then
    select b.bidder_id into v_winner_id
    from public.bids b
    where b.auction_id = old.id
    order by b.amount desc, b.created_at asc, b.id asc
    limit 1;

    new.ended_at := coalesce(new.ended_at, v_now);
    insert into public.auction_results (auction_id, winner_bidder_id, ended_at)
    values (old.id, v_winner_id, new.ended_at)
    on conflict (auction_id) do update
      set winner_bidder_id = excluded.winner_bidder_id,
          ended_at = excluded.ended_at;
  end if;

  return new;
end;
$function$;
