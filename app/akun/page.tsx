import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/money";
import { formatDateWIB } from "@/lib/auction";

export const metadata: Metadata = {
  title: "Akun Pengguna — TMD-WAR Lelang",
  description: "Kelola profil dan pantau riwayat penawaran lelang Anda di TMD-WAR.",
};

interface UserBid {
  id: number;
  amount: number;
  created_at: string;
  auction_id: string;
  auctions: { title: string } | { title: string }[] | null;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fakun");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const { data: bidsData } = await supabase
    .from("bids")
    .select("id, amount, created_at, auction_id, auctions(title)")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const bids = (bidsData ?? []) as unknown as UserBid[];

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "Peserta Lelang";

  const initialLetter = displayName.charAt(0).toUpperCase() || "P";
  const userRole = profile?.role ?? "bidder";

  const totalBids = bids.length;
  const highestBid = bids.reduce((max, b) => Math.max(max, b.amount), 0);

  return (
    <div className="app-container" style={{ padding: "48px 0 84px" }}>
      {/* Profile Overview Card */}
      <div
        className="card-framer"
        style={{
          padding: "clamp(24px, 4vw, 36px)",
          marginBottom: 36,
          background: "linear-gradient(145deg, var(--surface) 0%, var(--bg-subtle) 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--surface-elevated)",
                border: "2px solid var(--border-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
                color: "var(--gold)",
              }}
            >
              {initialLetter}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 900, letterSpacing: "-0.03em" }}>
                  {displayName}
                </h1>
                <span
                  style={{
                    backgroundColor: userRole === "admin" ? "var(--gold)" : "rgba(255, 255, 255, 0.08)",
                    color: userRole === "admin" ? "var(--text-inverse)" : "var(--text-main)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    padding: "3px 8px",
                    borderRadius: "var(--radius-sm)",
                    textTransform: "uppercase",
                  }}
                >
                  {userRole === "admin" ? "ADMINISTRATOR" : "VERIFIED BIDDER"}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                {user.email || "Email akun Facebook"} · Terdaftar sejak {formatDateWIB(profile?.created_at || user.created_at)}
              </p>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="btn-secondary"
              style={{ padding: "9px 16px", fontSize: 12 }}
            >
              Keluar Akun
            </button>
          </form>
        </div>

        {/* Profile Metric Highlights */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 32,
            borderTop: "1px solid var(--border)",
            paddingTop: 24,
          }}
        >
          <div style={{ backgroundColor: "var(--surface-elevated)", padding: "16px 20px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>
              TOTAL PENAWARAN AKTIF
            </div>
            <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 900, color: "var(--text-main)", marginTop: 4 }}>
              {totalBids} kali
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface-elevated)", padding: "16px 20px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>
              NOMINAL TERTINGGI DIAJUKAN
            </div>
            <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 900, color: "var(--gold)", marginTop: 4 }}>
              {rupiah(highestBid)}
            </div>
          </div>

          <div style={{ backgroundColor: "var(--surface-elevated)", padding: "16px 20px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.1em" }}>
              STATUS OTORISASI
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--status-success)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--status-success)" }} />
              Siap Mengikuti Lelang
            </div>
          </div>
        </div>
      </div>

      {/* Bid History Section */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase" }}>
              Aktivitas Pengguna
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4 }}>
              Riwayat Penawaran Saya
            </h2>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Menampilkan hingga 30 penawaran terbaru
          </div>
        </div>

        {bids.length > 0 ? (
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Lot Lelang</th>
                  <th scope="col">Waktu Penawaran</th>
                  <th scope="col" style={{ textAlign: "right" }}>Nominal Bid</th>
                  <th scope="col" style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => {
                  let lotTitle = "Barang Lelang";
                  if (b.auctions) {
                    if (Array.isArray(b.auctions)) {
                      lotTitle = b.auctions[0]?.title ?? "Barang Lelang";
                    } else {
                      lotTitle = b.auctions.title ?? "Barang Lelang";
                    }
                  }

                  return (
                    <tr key={b.id}>
                      <td>
                        <strong style={{ color: "var(--text-main)" }}>{lotTitle}</strong>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {formatDateWIB(b.created_at)}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: "right", fontWeight: 800, color: "var(--gold)" }}>
                        {rupiah(b.amount)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/lelang/${b.auction_id}`}
                          className="btn-secondary"
                          style={{ padding: "6px 12px", fontSize: 11 }}
                        >
                          Lihat Lot ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box">
            <div style={{ fontSize: 32, color: "var(--gold)", marginBottom: 12 }}>◈</div>
            <h3 className="empty-title">Belum Ada Penawaran</h3>
            <p className="empty-desc">
              Anda belum mengajukan penawaran pada lot manapun. Jelajahi katalog dan temukan barang pilihan Anda.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/#katalog" className="btn-primary">
                Jelajahi Katalog Lelang ↗
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
