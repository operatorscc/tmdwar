"use client";

import { useCallback, useEffect, useState } from "react";

type Submission = {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number | string;
  transfer_reference: string;
  proof_path: string;
  proofUrl: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  decided_at: string | null;
  rejection_reason: string | null;
  finance_transaction_id: string | null;
  auction: { title: string } | null;
  bidder: { display_name: string | null } | null;
};

function money(value: number | string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
}
function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function PaymentReviewClient() {
  const [items, setItems] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payments", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memuat pengajuan.");
      setItems(result.submissions ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat pengajuan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(item: Submission, decision: "approved" | "rejected") {
    if (busyId) return;
    let rejectionReason = "";
    if (decision === "approved" && !window.confirm("Pastikan transfer terlihat pada mutasi rekening dan nominal cocok. Setujui pembayaran ini?")) return;
    if (decision === "rejected") {
      const value = window.prompt("Masukkan alasan penolakan yang akan terlihat oleh pembeli:");
      if (value === null) return;
      rejectionReason = value.trim();
      if (!rejectionReason) {
        setError("Alasan penolakan wajib diisi.");
        return;
      }
    }
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: item.id, decision, rejectionReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Keputusan gagal disimpan.");
      setNotice(result.message || "Keputusan tersimpan.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Keputusan gagal disimpan.");
    } finally {
      setBusyId("");
    }
  }

  const visible = items.filter(item => filter === "all" || item.status === filter);
  const statusLabel = (status: Submission["status"]) => status === "pending" ? "Menunggu verifikasi" : status === "approved" ? "Disetujui" : "Ditolak";

  return (
    <section>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {(["pending", "approved", "rejected", "all"] as const).map(value => (
          <button key={value} type="button" className={filter === value ? "btn-primary" : "btn-secondary"} onClick={() => setFilter(value)} style={{ padding: "9px 13px" }}>
            {value === "all" ? "Semua" : value === "pending" ? "Menunggu" : value === "approved" ? "Disetujui" : "Ditolak"}
            {" "}({items.filter(item => value === "all" || item.status === value).length})
          </button>
        ))}
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>Muat ulang</button>
      </div>
      {error && <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="alert-success" role="status" style={{ marginBottom: 16 }}>{notice}</div>}
      {loading ? <p>Memuat pengajuan pembayaran…</p> : visible.length === 0 ? (
        <div className="empty-box"><h3 className="empty-title">Tidak ada pengajuan</h3><p className="empty-desc">Belum ada pembayaran dengan status ini.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {visible.map(item => (
            <article key={item.id} style={{ border: "1px solid var(--border, #30343b)", borderRadius: 14, padding: 18, background: "var(--surface, transparent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 17, marginBottom: 5 }}>{item.auction?.title || "Lot lelang"}</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{item.bidder?.display_name || "Pembeli"} · Diajukan {date(item.submitted_at)}</p>
                </div>
                <strong>{statusLabel(item.status)}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
                <div><small>Nominal</small><p style={{ fontWeight: 800 }}>{money(item.amount)}</p></div>
                <div><small>Referensi transfer</small><p style={{ overflowWrap: "anywhere" }}>{item.transfer_reference}</p></div>
                <div><small>ID pengajuan</small><p style={{ fontSize: 12, overflowWrap: "anywhere" }}>{item.id}</p></div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                {item.proofUrl ? <a href={item.proofUrl} target="_blank" rel="noreferrer" className="btn-secondary">Buka Bukti Transfer (5 menit)</a> : <span style={{ color: "var(--text-secondary)" }}>Bukti tidak dapat dibuka. Muat ulang untuk membuat tautan privat baru.</span>}
                {item.status === "pending" && <>
                  <button type="button" className="btn-primary" disabled={Boolean(busyId)} onClick={() => void decide(item, "approved")}>{busyId === item.id ? "Memproses…" : "Setujui Pembayaran"}</button>
                  <button type="button" className="btn-secondary" disabled={Boolean(busyId)} onClick={() => void decide(item, "rejected")}>Tolak</button>
                </>}
              </div>
              {item.rejection_reason && <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>Alasan penolakan: {item.rejection_reason}</p>}
              {item.finance_transaction_id && <p style={{ marginTop: 12, fontSize: 12 }}>Jurnal penerimaan: {item.finance_transaction_id}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
