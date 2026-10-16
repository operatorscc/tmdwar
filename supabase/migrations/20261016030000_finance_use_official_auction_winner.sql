-- Keep finance sale records aligned with the auction's private, finalized result.
-- This changes only winner resolution for new sale transactions; existing ledger rows are untouched.
CREATE OR REPLACE FUNCTION public.finance_record_transaction(
  p_kind text,
  p_auction_id uuid,
  p_amount bigint,
  p_transaction_date date,
  p_description text,
  p_counterparty text,
  p_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_transaction_id uuid;
  v_auction public.auctions%ROWTYPE;
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
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mencatat transaksi keuangan.';
  END IF;

  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;

  IF p_kind NOT IN ('inventory_purchase','sale','customer_receipt','operating_expense') THEN
    RAISE EXCEPTION 'Jenis transaksi tidak dikenal.';
  END IF;

  SELECT id INTO v_account_cash FROM public.finance_accounts WHERE code = '1000' AND is_active;
  SELECT id INTO v_account_inventory FROM public.finance_accounts WHERE code = '1200' AND is_active;
  SELECT id INTO v_account_receivable FROM public.finance_accounts WHERE code = '1300' AND is_active;
  SELECT id INTO v_account_sales FROM public.finance_accounts WHERE code = '4000' AND is_active;
  SELECT id INTO v_account_cogs FROM public.finance_accounts WHERE code = '5000' AND is_active;
  SELECT id INTO v_account_expense FROM public.finance_accounts WHERE code = '6000' AND is_active;

  IF v_account_cash IS NULL OR v_account_inventory IS NULL OR v_account_receivable IS NULL
     OR v_account_sales IS NULL OR v_account_cogs IS NULL OR v_account_expense IS NULL THEN
    RAISE EXCEPTION 'Akun sistem akuntansi belum lengkap.';
  END IF;

  IF p_kind = 'inventory_purchase' THEN
    IF p_auction_id IS NULL THEN RAISE EXCEPTION 'Pilih lot lelang untuk mencatat pembelian persediaan.'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Harga perolehan harus lebih besar dari nol.'; END IF;
    SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lot lelang tidak ditemukan.'; END IF;
    IF EXISTS (SELECT 1 FROM public.finance_inventory_costs WHERE auction_id = p_auction_id) THEN
      RAISE EXCEPTION 'Harga perolehan untuk lot ini sudah dicatat.';
    END IF;
    v_amount := p_amount;

  ELSIF p_kind = 'sale' THEN
    IF p_auction_id IS NULL THEN RAISE EXCEPTION 'Pilih lot lelang untuk mencatat penjualan.'; END IF;
    SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lot lelang tidak ditemukan.'; END IF;
    IF v_auction.status <> 'ended' THEN RAISE EXCEPTION 'Penjualan hanya dapat dicatat untuk lot berstatus selesai (ended).'; END IF;
    IF EXISTS (SELECT 1 FROM public.finance_transactions WHERE auction_id = p_auction_id AND kind = 'sale') THEN
      RAISE EXCEPTION 'Penjualan untuk lot ini sudah dicatat.';
    END IF;
    SELECT purchase_cost INTO v_cost FROM public.finance_inventory_costs WHERE auction_id = p_auction_id;
    IF v_cost IS NULL THEN RAISE EXCEPTION 'Catat harga perolehan/pembelian barang terlebih dahulu.'; END IF;

    -- auction_results is the authoritative, private record of the finalized winner.
    -- Require that winner to have an accepted bid and use the same deterministic tie-break
    -- as auction finalization (amount DESC, created_at ASC, bid id ASC).
    SELECT b.amount, COALESCE(NULLIF(TRIM(p.display_name), ''), 'Pemenang lelang')
      INTO v_sale_amount, v_winner_name
    FROM public.auction_results r
    JOIN public.bids b
      ON b.auction_id = r.auction_id
     AND b.bidder_id = r.winner_bidder_id
    LEFT JOIN public.profiles p ON p.id = r.winner_bidder_id
    WHERE r.auction_id = p_auction_id
    ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Hasil lelang resmi atau penawaran pemenang tidak ditemukan; penjualan tidak dapat dicatat.';
    END IF;
    IF v_sale_amount <> v_auction.current_price THEN
      RAISE EXCEPTION 'Harga akhir lot tidak cocok dengan penawaran pemenang resmi.';
    END IF;

    v_amount := v_sale_amount;
    IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Harga penjualan harus lebih besar dari nol.'; END IF;

  ELSIF p_kind = 'customer_receipt' THEN
    IF p_auction_id IS NULL THEN RAISE EXCEPTION 'Pilih lot penjualan untuk mencatat penerimaan.'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Penerimaan harus lebih besar dari nol.'; END IF;
    -- Lock the sale invoice row so concurrent receipts for the same lot serialize.
    SELECT amount INTO v_sale_amount
      FROM public.finance_transactions
      WHERE auction_id = p_auction_id AND kind = 'sale'
      FOR UPDATE;
    IF v_sale_amount IS NULL THEN RAISE EXCEPTION 'Faktur penjualan untuk lot ini belum ada.'; END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_received
      FROM public.finance_transactions
      WHERE auction_id = p_auction_id AND kind = 'customer_receipt';
    IF p_amount > v_sale_amount - v_received THEN
      RAISE EXCEPTION 'Penerimaan melebihi sisa piutang lot ini (%).', v_sale_amount - v_received;
    END IF;
    v_amount := p_amount;

  ELSE
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Beban operasional harus lebih besar dari nol.'; END IF;
    IF COALESCE(TRIM(p_description), '') = '' THEN RAISE EXCEPTION 'Keterangan beban operasional wajib diisi.'; END IF;
    v_amount := p_amount;
  END IF;

  INSERT INTO public.finance_transactions (
    transaction_date, kind, amount, auction_id, description, counterparty, reference, created_by
  ) VALUES (
    p_transaction_date,
    p_kind,
    v_amount,
    p_auction_id,
    COALESCE(NULLIF(TRIM(p_description), ''), CASE p_kind
      WHEN 'inventory_purchase' THEN 'Pembelian persediaan barang'
      WHEN 'sale' THEN 'Penjualan barang lelang'
      WHEN 'customer_receipt' THEN 'Penerimaan pembayaran pelanggan'
      ELSE 'Beban operasional'
    END),
    CASE WHEN p_kind = 'sale' THEN v_winner_name ELSE NULLIF(TRIM(p_counterparty), '') END,
    NULLIF(TRIM(p_reference), ''),
    v_uid
  ) RETURNING id INTO v_transaction_id;

  IF p_kind = 'inventory_purchase' THEN
    INSERT INTO public.finance_inventory_costs (
      auction_id, purchase_cost, acquired_at, supplier, notes, transaction_id
    ) VALUES (
      p_auction_id, v_amount, p_transaction_date, NULLIF(TRIM(p_counterparty), ''),
      NULLIF(TRIM(p_description), ''), v_transaction_id
    );

    INSERT INTO public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    VALUES
      (v_transaction_id, v_account_inventory, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_cash, p_auction_id, 0, v_amount);

  ELSIF p_kind = 'sale' THEN
    INSERT INTO public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    VALUES
      (v_transaction_id, v_account_receivable, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_sales, p_auction_id, 0, v_amount),
      (v_transaction_id, v_account_cogs, p_auction_id, v_cost, 0),
      (v_transaction_id, v_account_inventory, p_auction_id, 0, v_cost);

  ELSIF p_kind = 'customer_receipt' THEN
    INSERT INTO public.finance_journal_lines (transaction_id, account_id, auction_id, debit, credit)
    VALUES
      (v_transaction_id, v_account_cash, p_auction_id, v_amount, 0),
      (v_transaction_id, v_account_receivable, p_auction_id, 0, v_amount);

  ELSE
    INSERT INTO public.finance_journal_lines (transaction_id, account_id, debit, credit)
    VALUES
      (v_transaction_id, v_account_expense, v_amount, 0),
      (v_transaction_id, v_account_cash, 0, v_amount);
  END IF;

  RETURN v_transaction_id;
END;
$function$;
