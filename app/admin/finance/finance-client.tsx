"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
  journalLines: FinanceJournalLine[];
  auctions: FinanceAuction[];
  inventoryCosts: { auction_id: string; purchase_cost: number | string }[];
  sales: { auction_id: string | null; amount: number | string }[];
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/finance", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Gagal memuat data keuangan.");
      }
      setData(result as FinanceData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan saat memuat keuangan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const auctionMap = useMemo(() => {
    const map = new Map<string, FinanceAuction>();
    for (const auction of data?.auctions ?? []) map.set(auction.id, auction);
    return map;
  }, [data?.auctions]);

  const purchasedIds = useMemo(
    () => new Set((data?.inventoryCosts ?? []).map((item) => item.auction_id)),
    [data?.inventoryCosts],
  );
  const soldIds = useMemo(
    () => new Set((data?.sales ?? []).map((item) => item.auction_id).filter((id): id is string => Boolean(id))),
    [data?.sales],
  );

  const eligibleAuctions = useMemo(() => {
    const auctions = data?.auctions ?? [];
    if (kind === "inventory_purchase") return auctions.filter((auction) => !purchasedIds.has(auction.id));
    if (kind === "sale") return auctions.filter((auction) => auction.status === "ended" && purchasedIds.has(auction.id) && !soldIds.has(auction.id));
    if (kind === "customer_receipt") return auctions.filter((auction) => soldIds.has(auction.id));
    return [];
  }, [data?.auctions, kind, purchasedIds, soldIds]);

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
                        {auction.title} · {auction.status} · Harga {money(auction.current_price)}
                      </option>
                    ))}
                  </select>
                  {eligibleAuctions.length === 0 && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>
                      {kind === "inventory_purchase"
                        ? "Semua lot yang tersedia sudah memiliki catatan harga perolehan."
                        : kind === "sale"
                          ? "Penjualan hanya tersedia untuk lot berstatus ended yang harga perolehannya sudah dicatat dan belum pernah dijual."
                          : "Catat penjualan terlebih dahulu sebelum merekam penerimaan pembayaran."}
                    </p>
                  )}
                </div>
              )}

              {kind !== "sale" && (
                <div className="form-field">
                  <label className="form-label" htmlFor="finance-amount">
                    {kind === "inventory_purchase" ? "Harga perolehan barang (IDR)" : kind === "customer_receipt" ? "Nominal penerimaan (IDR)" : "Nominal beban (IDR)"}
                  </label>
                  <input id="finance-amount" className="form-input tabular-nums" type="number" min={1} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 5000000" />
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
                <button className="btn-primary" type="submit" disabled={saving || (kind !== "operating_expense" && !auctionId) || (kind !== "sale" && (!amount || Number(amount) <= 0))} style={{ padding: "12px 20px" }}>
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
                <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>100 transaksi terbaru. Untuk setiap transaksi, jurnal debit-kredit disimpan otomatis.</p>
              </div>
              <Link href="/admin/dashboard" className="btn-secondary" style={{ padding: "9px 14px", alignSelf: "start" }}>Kembali ke dashboard</Link>
            </div>
            {!data?.transactions.length ? (
              <div className="empty-box">Belum ada transaksi keuangan yang dicatat.</div>
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
                    {data.transactions.map((transaction) => (
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
          </section>

          <section className="admin-finance-section admin-finance-journal" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 22, marginTop: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 850, marginBottom: 6 }}>Jurnal umum</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>
              Rincian debit-kredit dari transaksi keuangan terbaru. Setiap transaksi yang diposting harus seimbang.
            </p>
            {!data?.journalLines.length ? (
              <div className="empty-box">Belum ada baris jurnal.</div>
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
                      const transaction = data.transactions.find((item) => item.id === line.transaction_id);
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
          </section>
        </>
      )}
    </div>
  );
}
