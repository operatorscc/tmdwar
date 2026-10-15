"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { type Auction, getAuctionState, formatDateWIB } from "@/lib/auction";
import { rupiah } from "@/lib/money";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import BidForm from "./bid-form";
import { createClient } from "@/lib/supabase/client";

export interface BidRecord {
  id: number;
  amount: number;
  created_at: string;
  bidder_name: string;
}

interface AuctionLiveViewProps {
  initialAuction: Auction;
  initialBids: BidRecord[];
  user: { id: string; email?: string } | null;
}

export function AuctionLiveView({
  initialAuction,
  initialBids,
  user,
}: AuctionLiveViewProps) {
  const [auction, setAuction] = useState<Auction>(initialAuction);
  const [bids, setBids] = useState<BidRecord[]>(initialBids);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const displayState = getAuctionState(auction);

  // Setup Supabase Realtime Subscription
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`auction-room-${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const updated = payload.new as Partial<Auction>;
          setAuction((prev) => ({
            ...prev,
            ...updated,
          }));

          // Bidder identities are private. Refresh the anonymized public feed
          // when the public auction row changes instead of subscribing to raw bids.
          void supabase
            .from("public_bid_feed")
            .select("id, amount, created_at, bidder_name")
            .eq("auction_id", auction.id)
            .order("amount", { ascending: false })
            .limit(20)
            .then(({ data, error }) => {
              if (!error && data) {
                setBids(data as BidRecord[]);
              }
            });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction.id]);

  const now = Date.now();
  const startsAtMs = auction.starts_at ? new Date(auction.starts_at).getTime() : 0;
  const endsAtMs = auction.ends_at ? new Date(auction.ends_at).getTime() : 0;
  const isTimeWindowOpen = startsAtMs <= now && (endsAtMs === 0 || endsAtMs > now);
  const canPlaceBid = Boolean(user) && auction.status === "live" && isTimeWindowOpen;

  const handleLocalBidSuccess = (amount: number) => {
    setAuction((prev) => ({
      ...prev,
      current_price: amount,
    }));
  };

  return (
    <div>
      {/* Detail Layout */}
      <div className="detail-layout">
        {/* Left: Product Artwork Gallery */}
        <div>
          <div className="detail-gallery">
            {auction.image_url ? (
              <img
                src={auction.image_url}
                alt={auction.title}
                className="artwork-img"
              />
            ) : (
              <div className="artwork-fallback" style={{ height: "100%", justifyContent: "center" }}>
                <div className="monogram" style={{ fontSize: 56 }}>TMD.</div>
                <div className="sub" style={{ fontSize: 11, marginTop: 8 }}>AUCTION HOUSE</div>
              </div>
            )}

            <div style={{ position: "absolute", top: 16, left: 16 }}>
              <StatusBadge state={displayState} />
            </div>

            <div style={{ position: "absolute", bottom: 16, left: 16 }}>
              <ModeBadge mode={auction.auction_mode} />
            </div>

            {realtimeConnected && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-full)",
                  padding: "4px 10px",
                  fontSize: 10,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "var(--status-success)",
                  }}
                />
                Live Realtime
              </div>
            )}
          </div>
        </div>

        {/* Right: Auction Information & Bidding Deck */}
        <div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "var(--gold)" }}>
                INFORMASI LOT RESMI
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(26px, 3.2vw, 38px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1.15,
                color: "var(--text-main)",
                marginBottom: 14,
              }}
            >
              {auction.title}
            </h1>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                marginBottom: 24,
              }}
            >
              {auction.description || "Tidak ada deskripsi tambahan dari kurator untuk lot ini."}
            </p>
          </div>

          {/* Pricing & Bid Card */}
          <div className="detail-panel">
            {/* Countdown Strip */}
            {displayState === "live" && auction.ends_at && (
              <div
                style={{
                  backgroundColor: "rgba(217, 181, 103, 0.08)",
                  border: "1px solid rgba(217, 181, 103, 0.2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--gold)" }}>
                  WAKTU PENUTUPAN:
                </span>
                <Countdown targetDate={auction.ends_at} labelPrefix="" />
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)" }}>
              {displayState === "scheduled" ? "HARGA AWAL PEMBUKAAN" : "PENAWARAN TERTINGGI SAAT INI"}
            </div>

            <div
              className="tabular-nums"
              style={{
                fontSize: "clamp(30px, 4vw, 42px)",
                fontWeight: 900,
                color: "var(--gold)",
                letterSpacing: "-0.03em",
                margin: "4px 0 16px",
              }}
            >
              {rupiah(auction.current_price ?? auction.starting_price)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                padding: "14px 0",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
                  HARGA AWAL
                </span>
                <strong className="tabular-nums">{rupiah(auction.starting_price)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
                  MIN. KENAIKAN
                </span>
                <strong className="tabular-nums">+{rupiah(auction.min_increment)}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 0", fontSize: 11.5, color: "var(--text-muted)" }}>
              <div>
                <span style={{ display: "block", fontWeight: 700 }}>Waktu Mulai:</span>
                <span>{formatDateWIB(auction.starts_at)}</span>
              </div>
              <div>
                <span style={{ display: "block", fontWeight: 700 }}>Waktu Berakhir:</span>
                <span>{formatDateWIB(auction.ends_at)}</span>
              </div>
            </div>

            {/* Bidding Section */}
            {canPlaceBid ? (
              <BidForm
                auctionId={auction.id}
                currentPrice={Number(auction.current_price ?? 0)}
                startingPrice={Number(auction.starting_price)}
                minIncrement={Number(auction.min_increment)}
                onBidSuccess={handleLocalBidSuccess}
              />
            ) : !user ? (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                  Masuk menggunakan akun Google atau Facebook untuk dapat mengajukan penawaran pada lelang ini.
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/lelang/${auction.id}`)}`}
                  className="btn-primary"
                  style={{ width: "100%", padding: "14px 20px" }}
                >
                  Masuk untuk Menawar ↗
                </Link>
              </div>
            ) : displayState === "scheduled" ? (
              <div className="empty-box" style={{ padding: "20px 14px", marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
                  Sesi Penawaran Belum Dibuka
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Penawaran akan aktif otomatis pada {formatDateWIB(auction.starts_at)}.
                </div>
              </div>
            ) : (
              <div className="empty-box" style={{ padding: "20px 14px", marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
                  Lelang Telah Berakhir
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Pemenang lot ditentukan oleh penawaran sah tertinggi terakhir.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bid History Section */}
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase" }}>
              Log Transparansi
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4 }}>
              Riwayat Penawaran ({bids.length})
            </h2>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Urut dari penawaran tertinggi
          </div>
        </div>

        {bids.length > 0 ? (
          <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Penawar</th>
                  <th scope="col">Waktu Penawaran</th>
                  <th scope="col" style={{ textAlign: "right" }}>Nominal Bid</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b, index) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {index === 0 && (
                          <span
                            style={{
                              backgroundColor: "var(--gold)",
                              color: "var(--text-inverse)",
                              fontSize: 9,
                              fontWeight: 900,
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            TERTINGGI
                          </span>
                        )}
                        <span style={{ fontWeight: index === 0 ? 700 : 500 }}>
                          {b.bidder_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {formatDateWIB(b.created_at)}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: "right", fontWeight: 800, color: index === 0 ? "var(--gold)" : "inherit" }}>
                      {rupiah(b.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box">
            <div style={{ fontSize: 24, color: "var(--gold)", marginBottom: 8 }}>◈</div>
            <div className="empty-title">Belum Ada Penawaran</div>
            <div className="empty-desc">
              Jadilah peserta pertama yang mengajukan penawaran pembuka untuk lot ini.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
