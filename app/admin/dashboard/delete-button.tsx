"use client";

interface DeleteButtonProps {
  id: string;
  title: string;
  canDelete: boolean;
}

export default function DeleteButton({ id, title, canDelete, status }: DeleteButtonProps) {
  const handleDelete = async () => {
    if (!canDelete) return;
    if (!confirm(`Hapus lelang "${title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/auctions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        window.location.reload();
      }
    } catch {
      alert("Gagal menghapus lelang.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={!canDelete}
      title={canDelete ? "Hapus draft atau lelang yang sudah selesai/dibatalkan tanpa riwayat transaksi" : "Lelang Terjadwal atau Live harus dibatalkan terlebih dahulu sebelum dihapus."}
      aria-label={canDelete ? `Hapus lelang ${title}` : `Lelang ${title} harus dibatalkan sebelum dihapus`}
      className="btn-secondary"
      style={{ padding: "5px 10px", fontSize: 11, color: canDelete ? "var(--status-live)" : "#8a94a6", borderColor: canDelete ? "var(--status-live-border)" : "#dfe4ec", cursor: canDelete ? "pointer" : "not-allowed", opacity: canDelete ? 1 : 0.72 }}
    >
      {canDelete ? "Hapus" : "Batalkan dulu"}
    </button>
  );
}
