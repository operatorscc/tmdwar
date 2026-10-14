"use client";

import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Auction, AuctionStatus } from "@/lib/auction";

interface AdminAuctionFormProps {
  mode: "create" | "edit";
  initialData?: Auction;
  auctionId?: string;
}

const STATUS_OPTIONS: { value: AuctionStatus; label: string }[] = [
  { value: "draft", label: "Draft (Disembunyikan)" },
  { value: "scheduled", label: "Terjadwal (Akan Tayang)" },
  { value: "live", label: "Live (Sedang Berlangsung)" },
  { value: "ended", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default function AdminAuctionForm({ mode, initialData, auctionId }: AdminAuctionFormProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(initialData?.image_url || null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (initialData?.image_url) {
      setPreview(initialData.image_url);
    }
  }, [initialData]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setRemoveImage(false);
    } else {
      setPreview(initialData?.image_url || null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const formData = new FormData(form);

    if (removeImage) {
      formData.append("removeImage", "true");
    }

    try {
      const url =
        mode === "create"
          ? "/api/admin/auctions"
          : `/api/admin/auctions/${auctionId}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Operasi gagal.");
      }

      setSuccess(mode === "create" ? "Lelang berhasil dibuat!" : "Lelang berhasil diperbarui!");
      if (mode === "create") {
        form.reset();
        setPreview(null);
        setRemoveImage(false);
      }

      // Redirect to dashboard after short delay
      setTimeout(() => router.push("/admin/dashboard"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-form-workspace">
      {error && (
        <div className="alert-error" style={{ marginBottom: 16 }} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert-success" style={{ marginBottom: 16 }} role="alert">
          {success}
        </div>
      )}

      <form className="admin-auction-form" onSubmit={handleSubmit} encType="multipart/form-data" style={{ display: "grid", gap: 20 }}>
        {/* Title */}
        <div className="form-field">
          <label htmlFor="title" className="form-label">
            Judul Lot <span style={{ color: "var(--status-live)" }}>*</span>
          </label>
          <input
            id="title"
            type="text"
            name="title"
            required
            minLength={3}
            maxLength={160}
            defaultValue={initialData?.title || ""}
            className="form-input"
            placeholder="Mis. Kamera Analog Leica M6 Classic"
          />
        </div>

        {/* Description */}
        <div className="form-field">
          <label htmlFor="description" className="form-label">
            Deskripsi
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={initialData?.description || ""}
            className="form-input"
            style={{ resize: "vertical", fontFamily: "inherit" }}
            placeholder="Detail kondisi, kelengkapan, sertifikat, dan informasi lainnya."
          />
        </div>

        {/* Mode + Status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-field">
            <label htmlFor="auctionMode" className="form-label">
              Mode Lelang
            </label>
            <select
              id="auctionMode"
              name="auctionMode"
              defaultValue={initialData?.auction_mode || "timed"}
              className="form-input"
            >
              <option value="timed">Timed Auction</option>
              <option value="live">Live Event</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="status" className="form-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={initialData?.status || "draft"}
              className="form-input"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Prices */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-field">
            <label htmlFor="startingPrice" className="form-label">
              Harga Awal (IDR) <span style={{ color: "var(--status-live)" }}>*</span>
            </label>
            <input
              id="startingPrice"
              type="number"
              name="startingPrice"
              required
              min={0}
              step={1}
              defaultValue={initialData?.starting_price ?? ""}
              className="form-input tabular-nums"
              placeholder="15000000"
            />
          </div>

          <div className="form-field">
            <label htmlFor="minIncrement" className="form-label">
              Kenaikan Minimum (IDR) <span style={{ color: "var(--status-live)" }}>*</span>
            </label>
            <input
              id="minIncrement"
              type="number"
              name="minIncrement"
              required
              min={1}
              step={1}
              defaultValue={initialData?.min_increment ?? ""}
              className="form-input tabular-nums"
              placeholder="250000"
            />
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-field">
            <label htmlFor="startsAt" className="form-label">
              Waktu Mulai <span style={{ color: "var(--status-live)" }}>*</span>
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              name="startsAt"
              required
              defaultValue={initialData?.starts_at ? toLocalInput(initialData.starts_at) : ""}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="endsAt" className="form-label">
              Waktu Berakhir <span style={{ color: "var(--status-live)" }}>*</span>
            </label>
            <input
              id="endsAt"
              type="datetime-local"
              name="endsAt"
              required
              defaultValue={initialData?.ends_at ? toLocalInput(initialData.ends_at) : ""}
              className="form-input"
            />
          </div>
        </div>

        {/* Image */}
        <div className="form-field">
          <label htmlFor="image" className="form-label">
            Gambar Produk {mode === "edit" && "(Kosongkan jika tidak diubah)"}
          </label>
          <input
            id="image"
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="form-input"
            style={{ padding: "8px" }}
          />
          {mode === "edit" && initialData?.image_url && !removeImage && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(e) => {
                  setRemoveImage(e.target.checked);
                  if (e.target.checked) setPreview(null);
                  else setPreview(initialData?.image_url || null);
                }}
              />
              Hapus gambar saat ini
            </label>
          )}
          {preview && (
            <div style={{ marginTop: 8, borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
              <img src={preview} alt="Preview" style={{ maxWidth: "100%", display: "block" }} />
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ padding: "14px 24px", fontSize: 14, fontWeight: 800 }}
          >
            {submitting
              ? "Memproses..."
              : mode === "create"
                ? "Buat Lelang"
                : "Simpan Perubahan"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/dashboard")}
            className="btn-secondary"
            style={{ padding: "14px 24px", fontSize: 14 }}
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Converts an ISO timestamp to the value expected by datetime-local input.
 */
function toLocalInput(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
