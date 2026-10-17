import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { type Auction, getAuctionState, formatDateWIB } from "@/lib/auction";
import { rupiah } from "@/lib/money";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { CatalogFilter } from "@/components/CatalogFilter";

export default async function HomePage() {
  const supabase = await createClient();

  let auctions: Auction[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await supabase
      .from("auctions")
      .select("id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at")
      .in("status", ["scheduled", "live", "ended"])
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      auctions = (data ?? []) as unknown as Auction[];
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data lelang.";
  }

  const items = auctions.map((a) => ({
    ...a,
    displayState: getAuctionState(a),
  }));

  const liveCount = items.filter((i) => i.displayState === "live").length;
  const scheduledCount = items.filter((i) => i.displayState === "scheduled").length;

  // Pick top featured lot: live lot first, or upcoming scheduled, or first item
  const featured =
    items.find((i) => i.displayState === "live") ??
    items.find((i) => i.displayState === "scheduled") ??
    items[0] ??
    null;

  return (
    <div>
      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="app-container hero-grid">
          <div>
            <div className="hero-eyebrow">
              <span className="line" aria-hidden="true" />
              <span>TEMUKAN · TAWAR · MENANGKAN</span>
            </div>

            <h1 className="hero-headline">
              Bukan sekadar
              <br />
              <span className="gold-text">membeli.</span>
              <br />
              Menangkan.
            </h1>

            <p className="hero-lead">
              Platform lelang pilihan untuk koleksi menarik dan barang bernilai tinggi.
              Pelajari detail lot, pantau harga, dan ajukan penawaran saat lelang berlangsung.
            </p>

            <div className="hero-ctas">
              <Link href="#katalog" className="btn-primary btn-lg">
                Jelajahi Katalog ↗
              </Link>
              <Link href="#panduan" className="btn-secondary btn-lg">
                Pelajari Cara Kerja
              </Link>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <div className="stat-num tabular-nums">
                  {String(items.length).padStart(2, "0")}
                </div>
                <div className="stat-label">Total Lot Tersedia</div>
              </div>
              <div className="stat-item">
                <div className="stat-num tabular-nums" style={{ color: liveCount > 0 ? "var(--status-live)" : "inherit" }}>
                  {String(liveCount).padStart(2, "0")}
                </div>
                <div className="stat-label">Sedang Live</div>
              </div>
              <div className="stat-item">
                <div className="stat-num tabular-nums" style={{ color: "var(--gold)" }}>
                  {String(scheduledCount).padStart(2, "0")}
                </div>
                <div className="stat-label">Segera Dimulai</div>
              </div>
            </div>
          </div>

          {/* FEATURED LOT CARD */}
          <div>
            {featured ? (
              <div
                className="card-framer"
                style={{
                  border: "1px solid var(--border-hover)",
                  boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55), 0 0 24px var(--gold-glow-subtle)",
                }}
              >
                <div className="artwork-container" style={{ aspectRatio: "16 / 11" }}>
                  {featured.image_url ? (
                    <img
                      src={featured.image_url}
                      alt={featured.title}
                      loading="eager"
                      className="artwork-img"
                    />
                  ) : (
                    <div className="artwork-fallback">
                      <div className="monogram">TMD.</div>
                      <div className="sub">FEATURED LOT</div>
                    </div>
                  )}

                  <div style={{ position: "absolute", top: 16, left: 16 }}>
                    <StatusBadge state={featured.displayState} />
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      backgroundColor: "rgba(0, 0, 0, 0.65)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid var(--border)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "var(--gold)",
                    }}
                  >
                    FEATURED LOT
                  </div>
                </div>

                <div style={{ padding: "clamp(20px, 3vw, 28px)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <ModeBadge mode={featured.auction_mode} />
                    {featured.displayState === "live" && featured.ends_at && (
                      <Countdown targetDate={featured.ends_at} labelPrefix="Berakhir dalam" />
                    )}
                  </div>

                  <h2
                    style={{
                      fontSize: "clamp(20px, 2.4vw, 26px)",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.25,
                      marginBottom: 10,
                    }}
                  >
                    {featured.title}
                  </h2>

                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--text-secondary)",
                      marginBottom: 20,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {featured.description || "Buka halaman detail lot untuk melihat riwayat penawaran dan spesifikasi barang."}
                  </p>

                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-muted)" }}>
                        {featured.displayState === "scheduled" ? "HARGA AWAL" : "PENAWARAN TERTINGGI SAAT INI"}
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: "clamp(22px, 2.6vw, 28px)",
                          fontWeight: 900,
                          color: "var(--gold)",
                          letterSpacing: "-0.03em",
                          marginTop: 4,
                        }}
                      >
                        {rupiah(featured.current_price ?? featured.starting_price)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        {featured.displayState === "scheduled"
                          ? `Mulai ${formatDateWIB(featured.starts_at)}`
                          : `Berakhir ${formatDateWIB(featured.ends_at)}`}
                      </div>
                    </div>

                    <Link
                      href={`/lelang/${featured.id}`}
                      className="btn-primary"
                      style={{ padding: "12px 20px" }}
                    >
                      Buka Lot ↗
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-box">
                <div style={{ fontSize: 36, color: "var(--gold)", marginBottom: 12 }}>◈</div>
                <h2 className="empty-title">Lelang Segera Hadir</h2>
                <p className="empty-desc">
                  Katalog sedang dipersiapkan oleh tim kurator. Pantau terus halaman ini untuk pembukaan lelang berikutnya.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="trust-bar" aria-label="Jaminan Keamanan dan Layanan">
        <div className="app-container trust-grid">
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">🔒</div>
            <div>
              <div className="trust-title">Keamanan Transaksi Terkunci</div>
              <div className="trust-desc">Penawaran diproses melalui sistem lelang dengan validasi harga dan waktu.</div>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">◈</div>
            <div>
              <div className="trust-title">100% Transparansi Riwayat</div>
              <div className="trust-desc">Riwayat penawaran dicatat dan ditampilkan sesuai aturan privasi platform.</div>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon" aria-hidden="true">⏱</div>
            <div>
              <div className="trust-title">Jadwal Penutupan Tegas</div>
              <div className="trust-desc">Waktu mulai dan berakhir dipantau presisi hingga detik penutupan.</div>
            </div>
          </div>
        </div>
      </section>

      {/* CATALOG SECTION */}
      <section id="katalog" className="catalog-section">
        <div className="app-container">
          <div className="section-header">
            <div>
              <div className="section-tag">Koleksi Pilihan</div>
              <h2 className="section-title">
                Katalog <span className="gold-text">Lelang</span>
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, maxWidth: 560 }}>
                Temukan barang incaran, pantau penawaran terkini, dan ikuti sesi lelang tepat waktu.
              </p>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              TOTAL <span className="tabular-nums" style={{ color: "var(--gold)", fontWeight: 700 }}>{items.length}</span> LOT TERDAFTAR
            </div>
          </div>

          {loadError && (
            <div className="alert-error" style={{ marginBottom: 24 }}>
              <strong>Katalog belum dapat tersambung:</strong> {loadError}
            </div>
          )}

          <CatalogFilter auctions={auctions} />
        </div>
      </section>

      {/* GUIDE / HOW IT WORKS SECTION */}
      <section id="panduan" style={{ padding: "clamp(56px, 7vw, 96px) 0", borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)" }}>
        <div className="app-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(36px, 5vw, 64px)" }}>
          <div>
            <div className="section-tag">Panduan Mengikuti</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.15, marginTop: 10 }}>
              Satu barang.
              <br />
              <span className="gold-text">Satu kesempatan.</span>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", marginTop: 16, maxWidth: 440 }}>
              Lelang TMD-WAR dirancang sederhana, transparan, dan adil. Ikuti 3 langkah mudah berikut untuk berpartisipasi.
            </p>
            <div style={{ marginTop: 28 }}>
              <Link href="#katalog" className="btn-primary">
                Pilih Barang Sekarang ↗
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              {
                step: "01",
                title: "Pilih Lot & Pelajari Ketentuan",
                desc: "Buka katalog, periksa foto detail, deskripsi barang, harga awal, kelipatan minimum kenaikan, dan jadwal lelang.",
              },
              {
                step: "02",
                title: "Masuk & Ajukan Penawaran",
                desc: "Masuk menggunakan Google atau Facebook. Ajukan penawaran sesuai kenaikan minimum saat lelang berstatus live.",
              },
              {
                step: "03",
                title: "Pantau Real-time & Menangkan",
                desc: "Perhatikan hitung mundur waktu. Penawar dengan nominal sah tertinggi pada saat lelang ditutup dinyatakan sebagai pemenang lot.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="card-framer"
                style={{ padding: "22px 24px", display: "grid", gridTemplateColumns: "48px 1fr", gap: 16, alignItems: "flex-start" }}
              >
                <div
                  className="tabular-nums"
                  style={{ fontSize: 24, fontWeight: 900, color: "var(--gold)", letterSpacing: "-0.05em", lineHeight: 1 }}
                >
                  {item.step}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
