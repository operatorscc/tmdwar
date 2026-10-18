"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type FinanceKind = "inventory_purchase" | "sale" | "customer_receipt" | "operating_expense";

interface FinanceSummary {
  cash: number | string;
  inventory: number | string;
  accounts_receivable: number | string;
  sales_revenue: number | string;
  cost_of_goods_sold: number | string;
  operating_expenses: number | string;
  gross_profit: number | string;
  net_profit: number | string;
}

interface FinanceAuction {
  id: string;
  title: string;
  status: string;
  current_price: number | string;
  starting_price: number | string;
}

interface FinanceTransaction {
  id: string;
  transaction_date: string;
  kind: FinanceKind;
  amount: number | string;
  auction_id: string | null;
  description: string;
  counterparty: string | null;
  reference: string | null;
  created_at: string;
}

interface FinanceJournalLine {
  id: number;
  transaction_id: string;
  auction_id: string | null;
  debit: number | string;
  credit: number | string;
  account: { code: string; name: string } | null;
}

interface FinanceData {
  summary: FinanceSummary;
  transactions: FinanceTransaction[];
  transactionPagination: { page: number; pageSize: number; total: number; totalPages: number };
  journalLines: FinanceJournalLine[];
  journalTransactions: { id: string; transaction_date: string; reference: string | null }[];
  journalPagination: { page: number; pageSize: number; total: number; totalPages: number };
  auctions: FinanceAuction[];
  inventoryCosts: { auction_id: string; purchase_cost: number | string }[];
  sales: { auction_id: string | null; amount: number | string }[];
  receipts: { auction_id: string | null; amount: number | string }[];
}

const KIND_LABELS: Record<FinanceKind, string> = {
  inventory_purchase: "Pembelian barang",
  sale: "Penjualan barang",
  customer_receipt: "Penerimaan pembayaran",
  operating_expense: "Beban operasional",
};

function localDateValue() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export default function FinanceClient() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<FinanceKind>("inventory_purchase");
  const [auctionId, setAuctionId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(localDateValue());
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [reference, setReference] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyKind, setHistoryKind] = useState<"all" | FinanceKind>("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(transactionPage),
        journalPage: String(journalPage),
        search: historySearch.trim(),
        kind: historyKind,
        from: historyFrom,
        to: historyTo,
      });
      const response = await fetch(`/api/admin/finance?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Gagal memuat data keuangan.");
      }
      if (requestId !== requestSequence.current) return;
      setData(result as FinanceData);
    } catch (caught) {
      if (requestId !== requestSequence.current) return;
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan saat memuat keuangan.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [transactionPage, journalPage, historySearch, historyKind, historyFrom, historyTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTransactionPage(1);
  }, [historySearch, historyKind, historyFrom, historyTo]);

  const auctionMap = useMemo(() => {
    const map = new Map<string, FinanceAuction>();
    for (const auction of data?.auctions ?? []) map.set(auction.id, auction);
    return map;
  }, [data?.auctions]);

  const journalTransactionMap = useMemo(
    () => new Map((data?.journalTransactions ?? []).map((transaction) => [transaction.id, transaction])),
    [data?.journalTransactions],
  );

  const purchasedIds = useMemo(
    () => new Set((data?.inventoryCosts ?? []).map((item) => item.auction_id)),
    [data?.inventoryCosts],
  );
  const soldIds = useMemo(
    () => new Set((data?.sales ?? []).map((item) => item.auction_id).filter((id): id is string => Boolean(id))),
    [data?.sales],
  );
  const paidByAuction = useMemo(() => {
    const totals = new Map<string, number>();
    for (const receipt of data?.receipts ?? []) {
      if (!receipt.auction_id) continue;
      totals.set(receipt.auction_id, (totals.get(receipt.auction_id) ?? 0) + Number(receipt.amount ?? 0));
    }
    return totals;
  }, [data?.receipts]);
  const saleByAuction = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of data?.sales ?? []) {
      if (!sale.auction_id) continue;
      totals.set(sale.auction_id, (totals.get(sale.auction_id) ?? 0) + Number(sale.amount ?? 0));
    }
    return totals;
  }, [data?.sales]);
  const remainingByAuction = useMemo(() => {
    const remaining = new Map<string, number>();
    for (const [id, total] of saleByAuction) {
      remaining.set(id, Math.max(0, total - (paidByAuction.get(id) ?? 0)));
    }
    return remaining;
  }, [saleByAuction, paidByAuction]);
  const selectedRemaining = remainingByAuction.get(auctionId) ?? 0;
  const visibleTransactions = data?.transactions ?? [];

  const eligibleAuctions = useMemo(() => {
    const auctions = data?.auctions ?? [];
    if (kind === "inventory_purchase") return auctions.filter((auction) => !purchasedIds.has(auction.id));
    if (kind === "sale") return auctions.filter((auction) => auction.status === "ended" && purchasedIds.has(auction.id) && !soldIds.has(auction.id));
    if (kind === "customer_receipt") return auctions.filter((auction) => soldIds.has(auction.id) && (remainingByAuction.get(auction.id) ?? 0) > 0);
    return [];
  }, [data?.auctions, kind, purchasedIds, soldIds, remainingByAuction]);

  useEffect(() => {
    if (kind === "operating_expense") {
      setAuctionId("");
      return;
    }
    if (!eligibleAuctions.some((auction) => auction.id === auctionId)) {
      setAuctionId(eligibleAuctions[0]?.id ?? "");
    }
  }, [kind, eligibleAuctions, auctionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          auctionId: auctionId || null,
          amount: kind === "sale" ? null : amount,
          transactionDate,
          description,
          counterparty,
          reference,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transaksi gagal disimpan.");

      setNotice(result.message || "Transaksi berhasil dicatat.");
      setAmount("");
      setDescription("");
      setCounterparty("");
      setReference("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-container admin-finance-page" style={{ padding: "40px 0 84px", maxWidth: 1180 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="section-tag">Panel Admin · Keuangan</div>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8 }}>
          Keuangan & Akuntansi
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8, maxWidth: 760 }}>
          Pencatatan persediaan barang, penjualan, penerimaan pembayaran manual, dan beban operasional dengan jurnal debit-kredit otomatis.
        </p>
      </div>

      {error && <div className="alert-error" role="alert" style={{ marginBottom: 16, overflowWrap: "anywhere" }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: 16 }}>{notice}</div>}

      {loading && !data ? (
        <div className="empty-box">Memuat data keuangan…</div>
      ) : (
        <>
          {data && (
            <div className="admin-finance-summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 32 }}>
              {[
                ["Kas tercatat", data.summary.cash],
                ["Nilai persediaan", data.summary.inventory],
                ["Piutang pelanggan", data.summary.accounts_receivable],
                ["Pendapatan penjualan", data.summary.sales_revenue],
                ["Harga pokok penjualan", data.summary.cost_of_goods_sold],
                ["Beban operasional", data.summary.operating_expenses],
                ["Laba kotor", data.summary.gross_profit],
                ["Laba / rugi sementara", data.summary.net_profit],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 18 }}>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 9 }}>{label}</div>
                  <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 850, color: label === "Laba / rugi sementara" ? "var(--gold)" : "var(--text-main)", overflowWrap: "anywhere" }}>
                    {money(value as string | number)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="admin-finance-section admin-finance-entry" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 22, marginBottom: 30 }}>
            <h2 style={{ fontSize: 20, fontWeight: 850, marginBottom: 6 }}>Catat transaksi</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 20 }}>
              Setiap penyimpanan membuat transaksi dan jurnal berpasangan secara atomik. Penjualan mengambil harga akhir dari lot berstatus selesai.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <div className="form-field">
                <label className="form-label" htmlFor="finance-kind">Jenis transaksi</label>
                <select id="finance-kind" className="form-input" value={kind} onChange={(event) => setKind(event.target.value as FinanceKind)}>
                  <option value="inventory_purchase">Pembelian barang / penambahan persediaan</option>
                  <option value="sale">Penjualan barang dari lot selesai</option>
                  <option value="customer_receipt">Penerimaan pembayaran pelanggan</option>
                  <option value="operating_expense">Beban operasional</option>
                </select>
              </div>

              {kind !== "operating_expense" && (
                <div className="form-field">
                  <label className="form-label" htmlFor="finance-auction">Lot lelang</label>
                  <select id="finance-auction" className="form-input" value={auctionId} onChange={(event) => setAuctionId(event.target.value)} required>
                    <option value="">Pilih lot</option>
                    {eligibleAuctions.map((auction) => (
                      <option key={auction.id} value={auction.id}>
                        {auction.title} · {auction.status} · Harga {money(auction.current_price)}{kind === "customer_receipt" ? ` · Sisa ${money(remainingByAuction.get(auction.id) ?? 0)}` : ""}
                      </option>
                    ))}
                  </select>
                  {eligibleAuctions.length === 0 && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>
                      {kind === "inventory_purchase"
                        ? "Semua lot yang tersedia sudah memiliki catatan harga perolehan."
                        : kind === "sale"
                          ? "Penjualan hanya tersedia untuk lot berstatus ended yang harga perolehannya sudah dicatat dan belum pernah dijual."
                          : "Tidak ada piutang tersisa untuk lot yang sudah terjual. Catat penjualan terlebih dahulu atau periksa riwayat penerimaan."}
                    </p>
                  )}
                </div>
              )}

              {kind !== "sale" && (
                <div className="form-field">
                  <label className="form-label" htmlFor="finance-amount">
                    {kind === "inventory_purchase" ? "Harga perolehan barang (IDR)" : kind === "customer_receipt" ? "Nominal penerimaan (IDR)" : "Nominal beban (IDR)"}
                  </label>
                  <input id="finance-amount" className="form-input tabular-nums" type="number" min={1} max={kind === "customer_receipt" ? selectedRemaining : undefined} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 5000000" />
                  {kind === "customer_receipt" && auctionId && (
                    <div style={{ marginTop: 8, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-elevated)", fontSize: 13 }}>
                      <div>Total penjualan: <strong>{money(saleByAuction.get(auctionId) ?? 0)}</strong></div>
                      <div>Sudah dibayar: <strong>{money(paidByAuction.get(auctionId) ?? 0)}</strong></div>
                      <div>Sisa piutang: <strong>{money(selectedRemaining)}</strong></div>
                      {Number(amount) > selectedRemaining && <p role="alert" style={{ color: "var(--danger, #c0392b)", marginTop: 6 }}>Nominal penerimaan tidak boleh melebihi sisa piutang.</p>}
                    </div>
                  )}
                </div>
              )}
              {kind === "sale" && (
                <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface-elevated)", color: "var(--text-secondary)", fontSize: 13 }}>
                  Nilai penjualan otomatis menggunakan harga akhir lot: <strong>{money(auctionMap.get(auctionId)?.current_price)}</strong>. Nilai ini bukan kas masuk; pembayaran dicatat terpisah.
                </div>
              )}

              <div className="form-field">
                <label className="form-label" htmlFor="finance-date">Tanggal transaksi</label>
                <input id="finance-date" className="form-input" type="date" required value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="finance-description">Keterangan</label>
                <input id="finance-description" className="form-input" value={description} onChange={(event) => setDescription(event.target.value)} required={kind === "operating_expense"} placeholder={kind === "operating_expense" ? "Contoh: biaya internet kantor" : "Keterangan (opsional)"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {kind !== "sale" && (
                  <div className="form-field">
                    <label className="form-label" htmlFor="finance-counterparty">{kind === "inventory_purchase" ? "Pemasok" : kind === "customer_receipt" ? "Pelanggan" : "Penerima / pihak terkait"}</label>
                    <input id="finance-counterparty" className="form-input" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Nama pihak (opsional)" />
                  </div>
                )}
                {kind === "sale" && (
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, alignSelf: "center" }}>
                    Nama pembeli diambil otomatis dari profil pemilik penawaran tertinggi yang tercatat.
                  </div>
                )}
                <div className="form-field">
                  <label className="form-label" htmlFor="finance-reference">Nomor bukti / referensi</label>
                  <input id="finance-reference" className="form-input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Nomor kuitansi, nota, dll. (opsional)" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn-primary" type="submit" disabled={saving || (kind !== "operating_expense" && !auctionId) || (kind !== "sale" && (!amount || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0)) || (kind === "customer_receipt" && Number(amount) > selectedRemaining)} style={{ padding: "12px 20px" }}>
                  {saving ? "Menyimpan…" : "Simpan transaksi"}
                </button>
                <button className="btn-secondary" type="button" onClick={() => void load()} disabled={loading || saving} style={{ padding: "12px 20px" }}>
                  Muat ulang
                </button>
              </div>
            </form>
          </section>

          <section className="admin-finance-section admin-finance-history" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 850 }}>Riwayat transaksi</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>Menampilkan {data?.transactionPagination.total ?? 0} hasil yang cocok, halaman {data?.transactionPagination.page ?? 1} dari {data?.transactionPagination.totalPages ?? 1}. Pencarian dan filter diterapkan ke seluruh histori.</p>
              </div>
              <Link href="/admin/dashboard" className="btn-secondary" style={{ padding: "9px 14px", alignSelf: "start" }}>Kembali ke dashboard</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 16 }}>
              <input className="form-input" aria-label="Cari transaksi" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Cari lot, pihak, referensi…" />
              <select className="form-input" aria-label="Filter jenis transaksi" value={historyKind} onChange={(event) => setHistoryKind(event.target.value as "all" | FinanceKind)}>
                <option value="all">Semua jenis transaksi</option>
                {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label className="form-field"><span className="form-label">Dari tanggal</span><input className="form-input" type="date" value={historyFrom} max={historyTo || undefined} onChange={(event) => setHistoryFrom(event.target.value)} /></label>
              <label className="form-field"><span className="form-label">Sampai tanggal</span><input className="form-input" type="date" value={historyTo} min={historyFrom || undefined} onChange={(event) => setHistoryTo(event.target.value)} /></label>
            </div>
            {!data?.transactionPagination.total ? (
              <div className="empty-box">Belum ada transaksi keuangan yang dicatat.</div>
            ) : visibleTransactions.length === 0 ? (
              <div className="empty-box">Tidak ada transaksi yang cocok dengan filter.</div>
            ) : (
              <div className="admin-finance-table-wrap" style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Jenis</th>
                      <th scope="col">Lot / Keterangan</th>
                      <th scope="col">Pihak terkait</th>
                      <th scope="col">Referensi</th>
                      <th scope="col" style={{ textAlign: "right" }}>Nominal transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{transaction.transaction_date}</td>
                        <td>{KIND_LABELS[transaction.kind] || transaction.kind}</td>
                        <td>
                          <div style={{ fontWeight: 650 }}>{transaction.auction_id ? auctionMap.get(transaction.auction_id)?.title || "Lot lelang" : "Operasional"}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{transaction.description}</div>
                        </td>
                        <td>{transaction.counterparty || "—"}</td>
                        <td>{transaction.reference || "—"}</td>
                        <td className="tabular-nums" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(transaction.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Halaman {data?.transactionPagination.page ?? 1} / {data?.transactionPagination.totalPages ?? 1}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" type="button" disabled={(data?.transactionPagination.page ?? 1) <= 1 || loading} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
                <button className="btn-secondary" type="button" disabled={(data?.transactionPagination.page ?? 1) >= (data?.transactionPagination.totalPages ?? 1) || loading} onClick={() => setTransactionPage((page) => page + 1)}>Berikutnya</button>
              </div>
            </div>
          </section>

          <section className="admin-finance-section admin-finance-journal" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 22, marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 850, marginBottom: 6 }}>Jurnal umum</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>
              Rincian debit-kredit dari transaksi keuangan terbaru. Setiap transaksi yang diposting harus seimbang.
            </p>
            {!data?.journalPagination.total ? (
              <div className="empty-box">Belum ada baris jurnal.</div>
            ) : data.journalLines.length === 0 ? (
              <div className="empty-box">Tidak ada baris jurnal pada halaman ini.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Referensi transaksi</th>
                      <th scope="col">Kode akun</th>
                      <th scope="col">Nama akun</th>
                      <th scope="col" style={{ textAlign: "right" }}>Debit</th>
                      <th scope="col" style={{ textAlign: "right" }}>Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.journalLines.map((line) => {
                      const transaction = journalTransactionMap.get(line.transaction_id);
                      return (
                        <tr key={line.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{transaction?.transaction_date || "—"}</td>
                          <td style={{ overflowWrap: "anywhere" }}>{transaction?.reference || line.transaction_id.slice(0, 8)}</td>
                          <td>{line.account?.code || "—"}</td>
                          <td>{line.account?.name || "Akun"}</td>
                          <td className="tabular-nums" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{Number(line.debit) > 0 ? money(line.debit) : "—"}</td>
                          <td className="tabular-nums" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{Number(line.credit) > 0 ? money(line.credit) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Halaman {data?.journalPagination.page ?? 1} / {data?.journalPagination.totalPages ?? 1} ({data?.journalPagination.total ?? 0} baris jurnal)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" type="button" disabled={(data?.journalPagination.page ?? 1) <= 1 || loading} onClick={() => setJournalPage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
                <button className="btn-secondary" type="button" disabled={(data?.journalPagination.page ?? 1) >= (data?.journalPagination.totalPages ?? 1) || loading} onClick={() => setJournalPage((page) => page + 1)}>Berikutnya</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
