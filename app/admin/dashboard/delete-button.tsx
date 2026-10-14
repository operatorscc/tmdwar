"use client";

interface DeleteButtonProps {
  id: string;
  title: string;
}

export default function DeleteButton({ id, title }: DeleteButtonProps) {
  const handleDelete = async () => {
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
      className="btn-secondary"
      style={{ padding: "5px 10px", fontSize: 11, color: "var(--status-live)", borderColor: "var(--status-live-border)" }}
    >
      Hapus
    </button>
  );
}
