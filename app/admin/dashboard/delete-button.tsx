"use client";

interface DeleteButtonProps {
  id: string;
  title: string;
  canDelete: boolean;
}

export default function DeleteButton({ id, title, canDelete }: DeleteButtonProps) {
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
      title={canDelete ? "Hapus lot berstatus draft" : "Hanya lelang berstatus Draft yang dapat dihapus. Lelang lain perlu ditangani sesuai status dan riwayat penawarannya."}
      aria-label={canDelete ? `Hapus lelang ${title}` : `Lelang ${title} tidak dapat dihapus karena bukan Draft`}
      className="btn-secondary"
      style={{ padding: "5px 10px", fontSize: 11, color: canDelete ? "var(--status-live)" : "#8a94a6", borderColor: canDelete ? "var(--status-live-border)" : "#dfe4ec", cursor: canDelete ? "pointer" : "not-allowed", opacity: canDelete ? 1 : 0.72 }}
    >
      {canDelete ? "Hapus" : "Hapus (Draft saja)"}
    </button>
  );
}
