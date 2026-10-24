"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Submission = {
  id: string;
  amount: number | string;
  transfer_reference: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  decided_at: string | null;
  rejection_reason: string | null;
};
type PaymentContext = {
  eligible: boolean;
  invoice_ready?: boolean;
  archived?: boolean;
  sale_amount?: number | string;
  received_amount?: number | string;
  outstanding_amount?: number | string;
  submissions?: Submission[];
};

function money(value: number | string | undefined) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}
function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
const statusLabel = (status: Submission["status"]) =>
  status === "pending" ? "Menunggu verifikasi admin" : status === "approved" ? "Pembayaran disetujui" : "Ditolak, silakan periksa alasan";

export default function PaymentSubmission({ auctionId }: { auctionId: string }) {
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [amount, setAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payments?auctionId=${encodeURIComponent(auctionId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memuat status pembayaran.");
      setContext(result as PaymentContext);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat status pembayaran.");
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setNotice("");

    const amountNumber = Number(amount);
    if (!Number.isSafeInteger(amountNumber) || amountNumber <= 0) {
      setError("Nominal harus berupa bilangan bulat rupiah positif.");
      return;
    }
    if (!transferReference.trim()) {
      setError("Nomor referensi transfer wajib diisi.");
      return;
    }
    if (!file) {
      setError("Unggah bukti transfer terlebih dahulu.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      setError("Format bukti harus JPG, PNG, WebP, atau PDF.");
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("Ukuran bukti maksimal 5 MB.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sesi login berakhir. Silakan login ulang.");

      const paymentId = crypto.randomUUID();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "bukti-transfer";
      const proofPath = `${user.id}/${paymentId}/${safeFilename}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(proofPath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("Gagal mengunggah bukti transfer: " + uploadError.message);

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          auctionId,
          amount: amountNumber,
          transferReference: transferReference.trim(),
          proofPath,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pengajuan pembayaran gagal.");
      setNotice(result.message || "Pembayaran diajukan untuk diverifikasi.");
      setAmount("");
      setTransferReference("");
      setFile(null);
      const input = document.getElementById(`payment-proof-${auctionId}`) as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pengajuan pembayaran gagal.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section style={{ marginTop: 28 }}><p>Memeriksa status pembayaran…</p></section>;
  if (!context?.eligible) return null;

  return (
    <section style={{ marginTop: 30, border: "1px solid var(--border, #30343b)", borderRadius: 16, padding: 20 }}>
      <p style={{ color: "var(--gold)", fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>PEMBAYARAN PEMENANG</p>
      <h2 style={{ fontSize: 22, marginTop: 6 }}>Verifikasi Transfer Bank</h2>
      {!context.invoice_ready ? (
        <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>Faktur pembayaran belum diterbitkan admin. Silakan cek kembali setelah faktur tersedia.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "16px 0" }}>
            <div><small>Total faktur</small><p style={{ fontWeight: 800 }}>{money(context.sale_amount)}</p></div>
            <div><small>Sudah diterima</small><p style={{ fontWeight: 800 }}>{money(context.received_amount)}</p></div>
            <div><small>Sisa piutang</small><p style={{ fontWeight: 800 }}>{money(context.outstanding_amount)}</p></div>
          </div>
          {(context.submissions ?? []).length > 0 && <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            <h3 style={{ fontSize: 15 }}>Riwayat pengajuan</h3>
            {(context.submissions ?? []).map(item => (
              <div key={item.id} style={{ border: "1px solid var(--border, #30343b)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{money(item.amount)}</strong><span>{statusLabel(item.status)}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Referensi: {item.transfer_reference} · {date(item.submitted_at)}</p>
                {item.rejection_reason && <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>Alasan: {item.rejection_reason}</p>}
              </div>
            ))}
          </div>}
          {context.archived && Number(context.outstanding_amount ?? 0) > 0 && (
            <p role="status" style={{ marginTop: 12, color: "var(--text-secondary)" }}>
              Lot ini sudah diarsipkan sehingga pengajuan transfer baru tidak dapat diproses melalui alur normal. Hubungi admin untuk penyelesaian piutang historis.
            </p>
          )}
          {!context.archived && Number(context.outstanding_amount ?? 0) > 0 && !(context.submissions ?? []).some(item => item.status === "pending") && (
            <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Unggah bukti transfer untuk pembayaran penuh atau sebagian. Pengajuan belum menambah saldo kas sebelum diverifikasi admin.</p>
              <label>Nominal transfer (Rp)
                <input type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required style={{ display: "block", width: "100%", marginTop: 6 }} />
              </label>
              <label>Nomor referensi transfer
                <input value={transferReference} onChange={event => setTransferReference(event.target.value)} maxLength={160} required style={{ display: "block", width: "100%", marginTop: 6 }} placeholder="Nomor referensi pada bukti transfer" />
              </label>
              <label>Bukti transfer (JPG, PNG, WebP, PDF; maksimal 5 MB)
                <input id={`payment-proof-${auctionId}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} required style={{ display: "block", width: "100%", marginTop: 6 }} />
              </label>
              {error && <p role="alert" className="alert-error">{error}</p>}
              {notice && <p role="status" className="alert-success">{notice}</p>}
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Mengirim pengajuan…" : "Kirim untuk Verifikasi"}</button>
            </form>
          )}
          {Number(context.outstanding_amount ?? 0) <= 0 && <p style={{ marginTop: 12 }}>Piutang sudah lunas berdasarkan penerimaan yang tercatat.</p>}
          {(context.submissions ?? []).some(item => item.status === "pending") && <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>Pengajuan sedang diperiksa. Tunggu keputusan admin sebelum mengirim pengajuan berikutnya.</p>}
        </>
      )}
      {(error || notice) && !context.invoice_ready && <p role={error ? "alert" : "status"} style={{ marginTop: 10 }}>{error || notice}</p>}
    </section>
  );
}
