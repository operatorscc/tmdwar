"use client";

import { useState } from "react";

interface ArchiveButtonProps {
  id: string;
  title: string;
}

interface ArchivePreview {
  title: string;
  status: string;
  counts: {
    bids: number;
    results: number;
    transactions: number;
    journalLines: number;
    inventoryCosts: number;
  };
}

export default function DeleteButton({ id, title }: ArchiveButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleArchive = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const previewResponse = await fetch(`/api/admin/auctions/${id}?archivePreview=1`, { cache: "no-store" });
      const preview = await previewResponse.json() as ArchivePreview & { error?: string };
      if (!previewResponse.ok || preview.error) {
        alert(preview.error || "Gagal memeriksa dampak arsip.");
        return;
      }

      const { counts } = preview;
      const detail = [
        `Arsipkan lelang: "${preview.title}"?`,
        `Status saat ini: ${preview.status}`,
        "",
        "Data yang tetap disimpan:",
        `• Penawaran: ${counts.bids}`,
        `• Hasil resmi: ${counts.results}`,
        `• Transaksi keuangan: ${counts.transactions}`,
        `• Baris jurnal: ${counts.journalLines}`,
        `• Biaya modal barang: ${counts.inventoryCosts}`,
        "",
        "Lelang tidak akan tampil di katalog. Jika sedang Terjadwal/Live, statusnya akan menjadi Dibatalkan. Tidak ada data keuangan yang dihapus.",
        "",
        "Lanjutkan?"
      ].join("\n");
      if (!window.confirm(detail)) return;

      const reason = window.prompt("Wajib isi alasan pengarsipan lelang:");
      if (reason === null) return;
      if (!reason.trim()) {
        alert("Alasan pengarsipan wajib diisi.");
        return;
      }

      const response = await fetch(`/api/admin/auctions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmTitle: preview.title, reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        alert(result.error || "Pengarsipan gagal.");
        return;
      }
      alert("Lelang berhasil diarsipkan. Data penawaran dan keuangan tetap tersimpan.");
      window.location.reload();
    } catch {
      alert("Gagal mengarsipkan lelang. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleArchive}
      disabled={busy}
      title="Arsipkan lelang dengan konfirmasi dampak; data keuangan tidak dihapus"
      aria-label={`Arsipkan lelang ${title}`}
      className="btn-secondary"
      style={{ padding: "5px 10px", fontSize: 11, color: "var(--status-live)", borderColor: "var(--status-live-border)", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.65 : 1 }}
    >
      {busy ? "Memproses…" : "Arsipkan"}
    </button>
  );
}
