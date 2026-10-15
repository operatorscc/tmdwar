begin;

create or replace function public.enforce_auction_integrity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_highest_bid bigint;
  v_now timestamptz := clock_timestamp();
begin
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
    raise exception 'Lelang berstatus % tidak dapat dibuka kembali atau diubah statusnya.', old.status
      using errcode = '23514';
  end if;

  select max(b.amount)
    into v_highest_bid
    from public.bids b
    where b.auction_id = old.id;

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
    select b.bidder_id
      into new.winner_bidder_id
      from public.bids b
      where b.auction_id = old.id
      order by b.amount desc, b.created_at asc, b.id asc
      limit 1;

    new.ended_at := coalesce(new.ended_at, v_now);
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_auction_integrity_before_update on public.auctions;
drop trigger if exists enforce_auction_integrity_before_write on public.auctions;
create trigger enforce_auction_integrity_before_write
before insert or update on public.auctions
for each row
execute function public.enforce_auction_integrity();

commit;
