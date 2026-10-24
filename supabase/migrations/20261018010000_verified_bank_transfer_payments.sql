begin;

-- Private bank-transfer proof storage. Never expose these files through a public bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete restrict,
  bidder_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  transfer_reference text not null check (length(btrim(transfer_reference)) between 1 and 160),
  proof_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default clock_timestamp(),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  finance_transaction_id uuid references public.finance_transactions(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payment_submissions_decision_check check (
    (status = 'pending' and decided_by is null and decided_at is null and finance_transaction_id is null and rejection_reason is null)
    or
    (status = 'approved' and decided_by is not null and decided_at is not null and finance_transaction_id is not null and rejection_reason is null)
    or
    (status = 'rejected' and decided_by is not null and decided_at is not null and finance_transaction_id is null and nullif(btrim(rejection_reason), '') is not null)
  )
);

create index if not exists payment_submissions_bidder_submitted_idx
  on public.payment_submissions (bidder_id, submitted_at desc);
create index if not exists payment_submissions_admin_queue_idx
  on public.payment_submissions (status, submitted_at asc);
create index if not exists payment_submissions_auction_idx
  on public.payment_submissions (auction_id, submitted_at desc);
create unique index if not exists payment_submissions_one_pending_per_auction_bidder_idx
  on public.payment_submissions (auction_id, bidder_id)
  where status = 'pending';

alter table public.payment_submissions enable row level security;

drop policy if exists "Bidders and admins can read payment submissions" on public.payment_submissions;
create policy "Bidders and admins can read payment submissions"
  on public.payment_submissions for select to authenticated
  using (bidder_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.payment_submissions from anon, authenticated;
grant select on public.payment_submissions to authenticated;

-- Evidence paths are user-id/payment-id/file-name. Clients cannot list or read other users' proofs.
drop policy if exists "Payment proof owner or admin read" on storage.objects;
create policy "Payment proof owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

drop policy if exists "Payment proof owner upload" on storage.objects;
create policy "Payment proof owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins delete payment proofs" on storage.objects;
create policy "Admins delete payment proofs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));

create or replace function public.submit_payment_proof(
  p_payment_id uuid,
  p_auction_id uuid,
  p_amount bigint,
  p_transfer_reference text,
  p_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $submit_payment$
declare
  v_uid uuid := auth.uid();
  v_sale_amount bigint;
  v_received bigint;
begin
  if v_uid is null then
    raise exception 'Login diperlukan untuk mengajukan pembayaran.';
  end if;
  if p_payment_id is null or p_auction_id is null then
    raise exception 'Data pengajuan pembayaran tidak lengkap.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih besar dari nol.';
  end if;
  if nullif(btrim(p_transfer_reference), '') is null or length(btrim(p_transfer_reference)) > 160 then
    raise exception 'Referensi transfer wajib diisi (maksimal 160 karakter).';
  end if;
  if p_proof_path is null
     or p_proof_path !~ ('^' || v_uid::text || '/' || p_payment_id::text || '/[^/]+$') then
    raise exception 'Lokasi bukti transfer tidak valid.';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'payment-proofs'
      and o.name = p_proof_path
  ) then
    raise exception 'File bukti transfer belum terunggah ke penyimpanan privat.';
  end if;

  -- Only the official auction winner may submit payment for a recorded sale.
  if not exists (
    select 1
    from public.auction_results r
    where r.auction_id = p_auction_id
      and r.winner_bidder_id = v_uid
  ) then
    raise exception 'Hanya pemenang resmi lelang yang dapat mengajukan pembayaran.';
  end if;

  -- Archived finance history is immutable; do not accept a submission that
  -- cannot be approved through the normal finance ledger path.
  if exists (
    select 1 from public.auctions a
    where a.id = p_auction_id and a.archived_at is not null
  ) then
    raise exception 'Lelang sudah diarsipkan. Hubungi admin untuk penyelesaian piutang historis.';
  end if;

  select t.amount into v_sale_amount
  from public.finance_transactions t
  where t.auction_id = p_auction_id
    and t.kind = 'sale'
  for update of t;

  if v_sale_amount is null then
    raise exception 'Faktur penjualan belum tersedia. Hubungi admin.';
  end if;

  select coalesce(sum(t.amount), 0) into v_received
  from public.finance_transactions t
  where t.auction_id = p_auction_id and t.kind = 'customer_receipt';

  if p_amount > v_sale_amount - v_received then
    raise exception 'Nominal melebihi sisa piutang. Sisa saat ini: %', v_sale_amount - v_received;
  end if;

  if exists (
    select 1 from public.payment_submissions s
    where s.auction_id = p_auction_id
      and s.bidder_id = v_uid
      and s.status = 'pending'
  ) then
    raise exception 'Masih ada pengajuan pembayaran yang menunggu verifikasi untuk lot ini.';
  end if;

  insert into public.payment_submissions (
    id, auction_id, bidder_id, amount, transfer_reference, proof_path
  ) values (
    p_payment_id, p_auction_id, v_uid, p_amount, btrim(p_transfer_reference), p_proof_path
  );

  return p_payment_id;
end;
$submit_payment$;

create or replace function public.review_payment_submission(
  p_payment_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $review_payment$
declare
  v_uid uuid := auth.uid();
  v_payment public.payment_submissions%rowtype;
  v_finance_transaction_id uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Hanya admin yang dapat memverifikasi pembayaran.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan verifikasi tidak valid.';
  end if;
  if p_decision = 'rejected'
     and (nullif(btrim(p_rejection_reason), '') is null or length(btrim(p_rejection_reason)) > 1000) then
    raise exception 'Alasan penolakan wajib diisi (maksimal 1.000 karakter).';
  end if;

  select * into v_payment
  from public.payment_submissions
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pengajuan pembayaran tidak ditemukan.';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Pengajuan ini sudah diputuskan dan tidak dapat diproses ulang.';
  end if;

  if p_decision = 'approved' then
    -- Reuse the existing authoritative finance RPC so receipt and balanced journal
    -- are written in the same database transaction as the approval status.
    v_finance_transaction_id := public.finance_record_transaction(
      'customer_receipt',
      v_payment.auction_id,
      v_payment.amount,
      (clock_timestamp() at time zone 'Asia/Jakarta')::date,
      'Verifikasi transfer pembayaran lelang',
      null,
      v_payment.transfer_reference
    );

    update public.payment_submissions
    set status = 'approved',
        decided_by = v_uid,
        decided_at = clock_timestamp(),
        rejection_reason = null,
        finance_transaction_id = v_finance_transaction_id,
        updated_at = clock_timestamp()
    where id = p_payment_id;

    return jsonb_build_object(
      'id', p_payment_id,
      'status', 'approved',
      'finance_transaction_id', v_finance_transaction_id
    );
  end if;

  update public.payment_submissions
  set status = 'rejected',
      decided_by = v_uid,
      decided_at = clock_timestamp(),
      rejection_reason = btrim(p_rejection_reason),
      finance_transaction_id = null,
      updated_at = clock_timestamp()
  where id = p_payment_id;

  return jsonb_build_object('id', p_payment_id, 'status', 'rejected');
end;
$review_payment$;

create or replace function public.payment_context_for_auction(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $payment_context$
declare
  v_uid uuid := auth.uid();
  v_sale_amount bigint;
  v_received bigint;
  v_is_winner boolean;
  v_archived boolean := false;
  v_submissions jsonb;
begin
  if v_uid is null then
    raise exception 'Login diperlukan untuk melihat status pembayaran.';
  end if;

  select exists (
    select 1 from public.auction_results r
    where r.auction_id = p_auction_id and r.winner_bidder_id = v_uid
  ) into v_is_winner;

  select coalesce(a.archived_at is not null, false)
    into v_archived
    from public.auctions a
    where a.id = p_auction_id;

  if not v_is_winner then
    return jsonb_build_object('eligible', false);
  end if;

  select t.amount into v_sale_amount
  from public.finance_transactions t
  where t.auction_id = p_auction_id and t.kind = 'sale'
  limit 1;

  if v_sale_amount is null then
    return jsonb_build_object('eligible', true, 'invoice_ready', false, 'archived', v_archived);
  end if;

  select coalesce(sum(t.amount), 0) into v_received
  from public.finance_transactions t
  where t.auction_id = p_auction_id and t.kind = 'customer_receipt';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'amount', s.amount,
    'transfer_reference', s.transfer_reference,
    'status', s.status,
    'submitted_at', s.submitted_at,
    'decided_at', s.decided_at,
    'rejection_reason', s.rejection_reason
  ) order by s.submitted_at desc), '[]'::jsonb)
  into v_submissions
  from public.payment_submissions s
  where s.auction_id = p_auction_id and s.bidder_id = v_uid;

  return jsonb_build_object(
    'eligible', true,
    'invoice_ready', true,
    'archived', v_archived,
    'sale_amount', v_sale_amount,
    'received_amount', v_received,
    'outstanding_amount', greatest(v_sale_amount - v_received, 0),
    'submissions', v_submissions
  );
end;
$payment_context$;

revoke all on function public.payment_context_for_auction(uuid) from public, anon;
grant execute on function public.payment_context_for_auction(uuid) to authenticated;

revoke all on function public.submit_payment_proof(uuid, uuid, bigint, text, text) from public, anon;
grant execute on function public.submit_payment_proof(uuid, uuid, bigint, text, text) to authenticated;
revoke all on function public.review_payment_submission(uuid, text, text) from public, anon;
grant execute on function public.review_payment_submission(uuid, text, text) to authenticated;

commit;
