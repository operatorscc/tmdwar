import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/validation";

const KINDS = new Set([
  "inventory_purchase",
  "sale",
  "customer_receipt",
  "operating_expense",
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Login admin diperlukan." }, { status: 401 });
  }

  const { isAdmin, error: adminError } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminError || "Akses ditolak." }, { status: 403 });
  }

  const [summaryResult, transactionsResult, auctionsResult, journalResult] = await Promise.all([
    supabase.rpc("finance_dashboard_summary"),
    supabase
      .from("finance_transactions")
      .select("id, transaction_date, kind, amount, auction_id, description, counterparty, reference, created_at")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("auctions")
      .select("id, title, status, current_price, starting_price")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("finance_journal_lines")
      .select("id, transaction_id, auction_id, debit, credit, account:finance_accounts(code, name)")
      .order("id", { ascending: false })
      .limit(300),
  ]);

  if (summaryResult.error) {
    return NextResponse.json(
      { error: "Gagal memuat ringkasan keuangan. Pastikan migration keuangan sudah dijalankan.", details: summaryResult.error.message },
      { status: 500 },
    );
  }
  if (transactionsResult.error) {
    return NextResponse.json({ error: "Gagal memuat transaksi: " + transactionsResult.error.message }, { status: 500 });
  }
  if (auctionsResult.error) {
    return NextResponse.json({ error: "Gagal memuat daftar lot: " + auctionsResult.error.message }, { status: 500 });
  }
  if (journalResult.error) {
    return NextResponse.json({ error: "Gagal memuat jurnal: " + journalResult.error.message }, { status: 500 });
  }

  const { data: inventoryCosts, error: costsError } = await supabase
    .from("finance_inventory_costs")
    .select("auction_id, purchase_cost");
  if (costsError) {
    return NextResponse.json({ error: "Gagal memuat harga perolehan: " + costsError.message }, { status: 500 });
  }

  const [salesResult, receiptsResult] = await Promise.all([
    supabase.from("finance_transactions").select("auction_id, amount").eq("kind", "sale"),
    supabase.from("finance_transactions").select("auction_id, amount").eq("kind", "customer_receipt"),
  ]);
  if (salesResult.error) {
    return NextResponse.json({ error: "Gagal memuat penjualan: " + salesResult.error.message }, { status: 500 });
  }
  if (receiptsResult.error) {
    return NextResponse.json({ error: "Gagal memuat penerimaan pembayaran: " + receiptsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    summary: summaryResult.data,
    transactions: transactionsResult.data ?? [],
    journalLines: journalResult.data ?? [],
    auctions: auctionsResult.data ?? [],
    inventoryCosts: inventoryCosts ?? [],
    sales: salesResult.data ?? [],
    receipts: receiptsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Login admin diperlukan." }, { status: 401 });
  }

  const { isAdmin, error: adminError } = await requireAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: adminError || "Akses ditolak." }, { status: 403 });
  }

  let body: {
    kind?: unknown;
    auctionId?: unknown;
    amount?: unknown;
    transactionDate?: unknown;
    description?: unknown;
    counterparty?: unknown;
    reference?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  const auctionId = typeof body.auctionId === "string" && body.auctionId ? body.auctionId : null;
  const amountText = body.amount === undefined || body.amount === null ? "" : String(body.amount);
  const amount = amountText === "" ? null : Number(amountText);
  const transactionDate = typeof body.transactionDate === "string" ? body.transactionDate : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const counterparty = typeof body.counterparty === "string" ? body.counterparty.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Jenis transaksi tidak valid." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) || Number.isNaN(Date.parse(transactionDate)) || new Date(`${transactionDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== transactionDate) {
    return NextResponse.json({ error: "Tanggal transaksi wajib diisi dengan format yang valid." }, { status: 400 });
  }
  if (kind !== "sale" && (amount === null || !Number.isSafeInteger(amount) || amount <= 0)) {
    return NextResponse.json({ error: "Nominal wajib berupa bilangan bulat positif." }, { status: 400 });
  }
  if (kind === "sale" && amountText !== "") {
    return NextResponse.json({ error: "Nilai penjualan diambil dari harga akhir lot, bukan input manual." }, { status: 400 });
  }
  if (["inventory_purchase", "sale", "customer_receipt"].includes(kind) && !auctionId) {
    return NextResponse.json({ error: "Pilih lot lelang terlebih dahulu." }, { status: 400 });
  }
  if (kind === "operating_expense" && !description) {
    return NextResponse.json({ error: "Keterangan beban operasional wajib diisi." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("finance_record_transaction", {
    p_kind: kind,
    p_auction_id: auctionId,
    p_amount: amount,
    p_transaction_date: transactionDate,
    p_description: description,
    p_counterparty: counterparty,
    p_reference: reference,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Transaksi gagal dicatat." }, { status: 400 });
  }

  return NextResponse.json({ message: "Transaksi keuangan berhasil dicatat.", id: data }, { status: 201 });
}
