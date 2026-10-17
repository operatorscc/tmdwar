import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";
import { formatDateWIB } from "@/lib/auction";
import DeleteButton from "./delete-button";

export const metadata: Metadata = {
  title: "Dashboard Admin — TMD-WAR",
  description: "Kelola semua lot lelang: lihat, edit, dan hapus.",
};

interface AdminAuction {
  id: string;
  title: string;
  auction_mode: string;
  status: string;
  starting_price: number;
  current_price: number;
  min_increment: number;
  starts_at: string;
  ends_at: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archive_reason: string | null;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    archived?: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Terjadwal",
  live: "Live",
  ended: "Selesai",
  cancelled: "Dibatalkan",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-muted)",
  scheduled: "var(--status-sched)",
  live: "var(--status-live)",
  ended: "var(--status-ended)",
  cancelled: "var(--status-ended)",
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fadmin%2Fdashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const page = Math.max(1, Number(params.page || "1"));
  const limit = 12;
  const offset = (page - 1) * limit;
  const statusFilter = params.status;
  const showArchived = params.archived === "1";
  const sortBy = params.sortBy || "created_at";
  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

  let query = supabase
    .from("auctions")
    .select("id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_at, updated_at, archived_at, archive_reason", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (statusFilter && !showArchived) {
    query = query.eq("status", statusFilter);
  }

  const { data: auctionsData, error, count } = await query;
  const auctions = (auctionsData ?? []) as unknown as AdminAuction[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const buildUrl = (changes: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { ...params, ...changes };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    return `/admin/dashboard?${sp.toString()}`;
  };

  return (
    <div className="app-container" style={{ padding: "48px 0 84px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div>
          <div className="section-tag">Panel Admin</div>
          <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, letterSpacing: "-0.04em", marginTop: 8 }}>
            Dashboard Lelang
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            {showArchived ? "Arsip lelang" : "Lelang aktif dan historis"}: {total} lot. Data arsip tetap tersimpan dan tidak menghapus jurnal keuangan.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={showArchived ? "/admin/dashboard" : "/admin/dashboard?archived=1"} className="btn-secondary" style={{ padding: "12px 20px" }}>
            {showArchived ? "Kembali ke Daftar Lelang" : "Lihat Arsip Lelang"}
          </Link>
          <Link href="/admin/finance" className="btn-secondary" style={{ padding: "12px 20px" }}>
            Keuangan & Akuntansi
          </Link>
          <Link href="/admin/auction" className="btn-primary" style={{ padding: "12px 20px" }}>
            + Buat Lelang Baru
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: 24 }}>
          <strong>Gagal memuat data:</strong> {error.message}
        </div>
      )}

      {/* Filters */}
      {!showArchived && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Link href={buildUrl({ status: undefined, page: undefined })} className={`filter-tab ${!statusFilter ? "active" : ""}`}>
          Semua
        </Link>
        {["draft", "scheduled", "live", "ended", "cancelled"].map((s) => (
          <Link key={s} href={buildUrl({ status: s, page: undefined })} className={`filter-tab ${statusFilter === s ? "active" : ""}`}>
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>}

      {showArchived && <p style={{ marginBottom: 20, color: "var(--text-secondary)", fontSize: 13 }}>Arsip tidak tampil di katalog publik. Riwayat penawaran, hasil lelang, transaksi, jurnal, dan biaya tetap dipertahankan.</p>}

      {/* Table */}
      {auctions.length > 0 ? (
        <>
        <div className="admin-auction-table-wrap" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Lot</th>
                <th scope="col">Status</th>
                <th scope="col">Mode</th>
                <th scope="col" style={{ textAlign: "right" }}>Harga Awal</th>
                <th scope="col" style={{ textAlign: "right" }}>Penawaran Tertinggi</th>
                <th scope="col">Mulai</th>
                <th scope="col">Berakhir</th>
                <th scope="col" style={{ textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", backgroundColor: "var(--surface-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontSize: 10, fontWeight: 800 }}>
                          TMD
                        </div>
                      )}
                      <div><span style={{ fontWeight: 600 }}>{a.title}</span>{showArchived && a.archive_reason && <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>Alasan arsip: {a.archive_reason}</div>}</div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: STATUS_COLORS[a.status] || "var(--text-main)", fontWeight: 700, fontSize: 12 }}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {a.auction_mode === "live" ? "Live Event" : "Timed"}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: "right", fontSize: 12 }}>
                    {rupiah(a.starting_price)}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: "right", fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>
                    {rupiah(a.current_price)}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {formatDateWIB(a.starts_at)}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {formatDateWIB(a.ends_at)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {!showArchived && <Link
                        href={`/lelang/${a.id}`}
                        className="btn-secondary"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                      >
                        Lihat
                      </Link>}
                      {!showArchived && <Link
                        href={`/admin/auction/${a.id}`}
                        className="btn-secondary"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                      >
                        Edit
                      </Link>}
                      {showArchived ? <span className="filter-tab active">Diarsipkan</span> : <DeleteButton id={a.id} title={a.title} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Compact card layout for phones */}
        <div className="admin-auction-cards" aria-label="Daftar lelang">
          {auctions.map((a) => (
            <article key={a.id} className="admin-auction-card">
              <div className="admin-auction-card-head">
                {a.image_url ? (
                  <img src={a.image_url} alt="" className="admin-auction-card-image" loading="lazy" />
                ) : (
                  <div className="admin-auction-card-image" style={{ display: "grid", placeItems: "center", color: "var(--gold)", fontSize: 11, fontWeight: 900 }}>TMD</div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="admin-auction-card-title">{a.title}</div>{showArchived && a.archive_reason && <div className="admin-auction-card-meta">Alasan arsip: {a.archive_reason}</div>
                  <div className="admin-auction-card-meta">
                    <span style={{ color: STATUS_COLORS[a.status] || "var(--text-secondary)", fontWeight: 800 }}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                    {" · "}
                    {a.auction_mode === "live" ? "Live Event" : "Timed Auction"}
                  </div>
                  <div className="admin-auction-card-meta">Mulai {formatDateWIB(a.starts_at)}</div>
                  <div className="admin-auction-card-meta">Berakhir {formatDateWIB(a.ends_at)}</div>
                </div>
              </div>

              <div className="admin-auction-card-price-grid">
                <div>
                  <div className="admin-auction-card-label">Harga awal</div>
                  <div className="admin-auction-card-value tabular-nums">{rupiah(a.starting_price)}</div>
                </div>
                <div>
                  <div className="admin-auction-card-label">Penawaran tertinggi</div>
                  <div className="admin-auction-card-value tabular-nums" style={{ color: "var(--gold)" }}>{rupiah(a.current_price)}</div>
                </div>
              </div>

              <div className="admin-auction-card-actions">
                {!showArchived && <><Link href={`/lelang/${a.id}`} className="btn-secondary">Lihat</Link>
                <Link href={`/admin/auction/${a.id}`} className="btn-secondary">Edit</Link>
                <DeleteButton id={a.id} title={a.title} /></>}
                {showArchived && <span className="filter-tab active">Diarsipkan</span>}
              </div>
            </article>
          ))}
        </div>
        </>
      ) : (
        <div className="empty-box">
          <div style={{ fontSize: 32, color: "var(--gold)", marginBottom: 8 }}>◈</div>
          <h3 className="empty-title">{showArchived ? "Belum Ada Arsip" : "Belum Ada Lelang"}</h3>
          <p className="empty-desc">
            {showArchived ? "Belum ada lelang yang diarsipkan." : "Belum ada lot lelang yang sesuai dengan filter ini. Buat lelang baru untuk memulai."}
          </p>
          <div style={{ marginTop: 20 }}>
            {!showArchived && <Link href="/admin/auction" className="btn-primary">
              + Buat Lelang Baru
            </Link>}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          {page > 1 && (
            <Link href={buildUrl({ page: String(page - 1) })} className="btn-secondary" style={{ padding: "8px 14px", fontSize: 12 }}>
              ← Sebelumnya
            </Link>
          )}
          <span style={{ display: "flex", alignItems: "center", padding: "0 16px", fontSize: 12, color: "var(--text-muted)" }}>
            Halaman {page} dari {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildUrl({ page: String(page + 1) })} className="btn-secondary" style={{ padding: "8px 14px", fontSize: 12 }}>
              Berikutnya →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
