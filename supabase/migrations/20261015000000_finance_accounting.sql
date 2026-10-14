-- TMD-WAR Finance & Accounting module.
-- Additive migration: preserves existing auction/bid tables and place_bid().
-- Run through Supabase Dashboard > SQL Editor if migrations are not CLI-managed.

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.finance_accounts (code, name, account_type, normal_balance, is_system)
values
  ('1000', 'Kas', 'asset', 'debit', true),
  ('1200', 'Persediaan Barang Dagang', 'asset', 'debit', true),
  ('1300', 'Piutang Usaha', 'asset', 'debit', true),
  ('4000', 'Penjualan Barang', 'revenue', 'credit', true),
  ('5000', 'Harga Pokok Penjualan', 'expense', 'debit', true),
  ('6000', 'Beban Operasional', 'expense', 'debit', true)
on conflict (code) do nothing;

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  kind text not null check (kind in ('inventory_purchase','sale','customer_receipt','operating_expense')),
  amount bigint not null check (amount > 0),
  auction_id uuid references public.auctions(id) on delete restrict,
  description text not null,
  counterparty text,
  reference text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_date_idx
  on public.finance_transactions(transaction_date desc, created_at desc);
create index if not exists finance_transactions_kind_idx
  on public.finance_transactions(kind, transaction_date desc);
create index if not exists finance_transactions_auction_idx
  on public.finance_transactions(auction_id, kind);

create table if not exists public.finance_inventory_costs (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references public.auctions(id) on delete restrict,
  purchase_cost bigint not null check (purchase_cost > 0),
  acquired_at date not null,
  supplier text,
  notes text,
  transaction_id uuid not null unique references public.finance_transactions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_journal_lines (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.finance_transactions(id) on delete restrict,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  auction_id uuid references public.auctions(id) on delete restrict,
  debit bigint not null default 0 check (debit >= 0),
  credit bigint not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists finance_journal_transaction_idx
  on public.finance_journal_lines(transaction_id);
create index if not exists finance_journal_account_idx
  on public.finance_journal_lines(account_id, created_at);
create index if not exists finance_journal_auction_idx
  on public.finance_journal_lines(auction_id, account_id);

alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_inventory_costs enable row level security;
alter table public.finance_journal_lines enable row level security;

drop policy if exists "Finance admins read accounts" on public.finance_accounts;
drop policy if exists "Finance admins read accounts" on public.finance_accounts;
create policy "Finance admins read accounts"
on public.finance_accounts for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Finance admins read transactions" on public.finance_transactions;
drop policy if exists "Finance admins read transactions" on public.finance_transactions;
create policy "Finance admins read transactions"
on public.finance_transactions for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Finance admins read inventory costs" on public.finance_inventory_costs;
drop policy if exists "Finance admins read inventory costs" on public.finance_inventory_costs;
create policy "Finance admins read inventory costs"
on public.finance_inventory_costs for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Finance admins read journal lines" on public.finance_journal_lines;
drop policy if exists "Finance admins read journal lines" on public.finance_journal_lines;
create policy "Finance admins read journal lines"
on public.finance_journal_lines for select to authenticated
using ((select public.is_admin()));

revoke all on public.finance_accounts from anon, authenticated;
revoke all on public.finance_transactions from anon, authenticated;
revoke all on public.finance_inventory_costs from anon, authenticated;
revoke all on public.finance_journal_lines from anon, authenticated;
grant select on public.finance_accounts, public.finance_transactions,
  public.finance_inventory_costs, public.finance_journal_lines to authenticated;

-- Every financial event is posted atomically by this function.
-- The function verifies admin role, creates the transaction header, and writes
-- balanced double-entry journal lines. It does not mutate auctions or bids.
create or replace function public.finance_record_transaction(
  p_kind text,
  p_auction_id uuid,
  p_amount bigint,
  p_transaction_date date,
  p_description text,
  p_counterparty text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_transaction_id uuid;
  v_auction public.auctions%rowtype;
  v_amount bigint;
  v_cost bigint;
  v_sale_amount bigint;
  v_received bigint;
  v_winner_name text;
  v_account_cash uuid;
  v_account_inventory uuid;
  v_account_receivable uuid;
  v_account_sales uuid;
  v_account_cogs uuid;
  v_account_expense uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat mencatat transaksi keuangan.';
  end if;

  if p_transaction_date is null then
    raise exception 'Tanggal transaksi wajib diisi.';
  end if;

  if p_kind not in ('inventory_purchase','sale','customer_receipt','operating_expense') then
    raise exception 'Jenis transaksi tidak dikenal.';
  end if;

  select id into v_account_cash from public.finance_accounts where code = '1000' and is_active;
  select id into v_account_inventory from public.finance_accounts where code = '1200' and is_active;
  select id into v_account_receivable from public.finance_accounts where code = '1300' and is_active;
  select id into v_account_sales from public.finance_accounts where code = '4000' and is_active;
  select id into v_account_cogs from public.finance_accounts where code = '5000' and is_active;
  select id into v_account_expense from public.finance_accounts where code = '6000' and is_active;

  if v_account_cash is null or v_account_inventory is null or v_account_receivable is null
     or v_account_sales is null or v_account_cogs is null or v_account_expense is null then
    raise exception 'Akun sistem akuntansi belum lengkap.';
  end if;

  if p_kind = 'inventory_purchase' then
    if p_auction_id is null then raise exception 'Pilih lot lelang untuk mencatat pembelian persediaan.'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'Harga perolehan harus lebih besar dari nol.'; end if;
    select * into v_auction from public.auctions where id = p_auction_id for update;
    if not found then raise exception 'Lot lelang tidak ditemukan.'; end if;
    if exists (select 1 from public.finance_inventory_costs where auction_id = p_auction_id) then
      raise exception 'Harga perolehan untuk lot ini sudah dicatat.';
    end if;
    v_amount := p_amount;
  elsif p_kind = 'sale' then
    if p_auction_id is null then raise exception 'Pilih lot lelang untuk mencatat penjualan.'; end if;
    select * into v_auction from public.auctions where id = p_auction_id for update;
    if not found then raise exception 'Lot lelang tidak ditemukan.'; end if;
    if v_auction.status <> 'ended' then raise exception 'Penjualan hanya dapat dicatat untuk lot berstatus selesai (ended).'; end if;
    if exists (select 1 from public.finance_transactions where auction_id = p_auction_id and kind = 'sale') then
      raise exception 'Penjualan untuk lot ini sudah dicatat.';
    end if;
    select purchase_cost into v_cost from public.finance_inventory_costs where auction_id = p_auction_id;
    if v_cost is null then raise exception 'Catat harga perolehan/pembelian barang terlebih dahulu.'; end if;

    -- The base schema has no explicit winner column. Verify the accepted bid log
    -- and derive the buyer from the highest accepted bid; do not assume every
    -- ended auction was sold.
    select b.amount, coalesce(nullif(trim(p.display_name), ''), 'Pemenang lelang')
      into v_sale_amount, v_winner_name
    from public.bids b
    left join public.profiles p on p.id = b.bidder_id
    where b.auction_id = p_auction_id
    order by b.amount desc, b.created_at asc
    limit 1;

    if not found then
      raise exception 'Lot ini tidak memiliki penawaran yang diterima; penjualan tidak dapat dicatat.';
    end if;
    if v_sale_amount <> v_auction.current_price then
      raise exception 'Harga akhir lot tidak cocok dengan penawaran tertinggi yang tercatat.';
    end if;

    v_amount := v_sale_amount;
    if v_amount is null or v_amount <= 0 then raise exception 'Harga penjualan harus lebih besar dari nol.'; end if;
  elsif p_kind = 'customer_receipt' then
    if p_auction_id is null then raise exception 'Pilih lot penjualan untuk mencatat penerimaan.'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'Penerimaan harus lebih besar dari nol.'; end if;
    select amount into v_sale_amount
      from public.finance_transactions
      where auction_id = p_auction_id and kind = 'sale'
      for update;
    if v_sale_amount is null then raise exception 'Faktur penjualan untuk lot ini belum ada.'; end if;
    select coalesce(sum(amount), 0) into v_received
      from public.finance_transactions
      where auction_id = p_auction_id and kind = 'customer_receipt';
    if p_amount > v_sale_amount - v_received then
      raise exception 'Penerimaan melebihi sisa piutang lot ini (%).', v_sale_amount - v_received;
    end if;
    v_amount := p_amount;
  else
    if p_amount is null or p_amount <= 0 then raise exception 'Beban operasional harus lebih besar dari nol.'; end if;
    if coalesce(trim(p_description), '') = '' then raise exception 'Keterangan beban operasional wajib diisi.'; end if;
    v_amount := p_amount;
  end if;

  insert into public.finance_transactions (
    transaction_date, kind, amount, auction_id, description, counterparty, reference, created_by
  ) values (
    p_transaction_date,
    p_kind,
    v_amount,
    p_auction_id,
    coalesce(nullif(trim(p_description), ''), case p_kind
      when 'inventory_purchase' then 'Pembelian persediaan barang'
      when 'sale' then 'Penjualan barang lelang'
      when 'customer_receipt' then 'Penerimaan pembayaran pelanggan'
      else 'Beban operasional'
    end),
    case when p_kind = 'sale' then v_winner_name else nullif(trim(p_counterparty), '') end,
    nullif(trim(p_reference), ''),
    v_uid
  ) returning id into v_transaction_id;

  if p_kind = 'inventory_purchase' then
    insert into public.finance_inventory_costs (
      auction_id, purchase_cost, acquired_at, supplier, notes, transaction_id
    ) values (
      p_auction_id, v_amount, p_transaction_date, nullif(trim(p_counterparty), ''),
      nullif(trim(p_description), ''), v_transaction_id
    );

    insert into public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    values
      (v_transaction_id, v_account_inventory, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_cash, p_auction_id, 0, v_amount);

  elsif p_kind = 'sale' then
    insert into public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    values
      (v_transaction_id, v_account_receivable, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_sales, p_auction_id, 0, v_amount),
      (v_transaction_id, v_account_cogs, p_auction_id, v_cost, 0),
      (v_transaction_id, v_account_inventory, p_auction_id, 0, v_cost);

  elsif p_kind = 'customer_receipt' then
    insert into public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    values
      (v_transaction_id, v_account_cash, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_receivable, p_auction_id, 0, v_amount);

  else
    insert into public.finance_journal_lines (transaction_id, account_id, debit, credit)
    values
      (v_transaction_id, v_account_expense, v_amount, 0),
      (v_transaction_id, v_account_cash, 0, v_amount);
  end if;

  return v_transaction_id;
end;
$$;

revoke all on function public.finance_record_transaction(text,uuid,bigint,date,text,text,text) from public, anon;
grant execute on function public.finance_record_transaction(text,uuid,bigint,date,text,text,text) to authenticated;

create or replace function public.finance_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cash bigint;
  v_inventory bigint;
  v_receivables bigint;
  v_revenue bigint;
  v_cogs bigint;
  v_expenses bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat melihat ringkasan keuangan.';
  end if;

  select coalesce(sum(j.debit - j.credit), 0) into v_cash
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '1000';
  select coalesce(sum(j.debit - j.credit), 0) into v_inventory
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '1200';
  select coalesce(sum(j.debit - j.credit), 0) into v_receivables
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '1300';
  select coalesce(sum(j.credit - j.debit), 0) into v_revenue
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '4000';
  select coalesce(sum(j.debit - j.credit), 0) into v_cogs
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '5000';
  select coalesce(sum(j.debit - j.credit), 0) into v_expenses
  from public.finance_journal_lines j join public.finance_accounts a on a.id = j.account_id
  where a.code = '6000';

  return jsonb_build_object(
    'cash', v_cash,
    'inventory', v_inventory,
    'accounts_receivable', v_receivables,
    'sales_revenue', v_revenue,
    'cost_of_goods_sold', v_cogs,
    'operating_expenses', v_expenses,
    'gross_profit', v_revenue - v_cogs,
    'net_profit', v_revenue - v_cogs - v_expenses
  );
end;
$$;

revoke all on function public.finance_dashboard_summary() from public, anon;
grant execute on function public.finance_dashboard_summary() to authenticated;
