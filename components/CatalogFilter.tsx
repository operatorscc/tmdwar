"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { type Auction, getAuctionState, formatDateWIB } from "@/lib/auction";
import { rupiah } from "@/lib/money";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";

interface CatalogFilterProps {
  auctions: Auction[];
}

export function CatalogFilter({ auctions }: CatalogFilterProps) {
  const [activeTab, setActiveTab] = useState<"all" | "live" | "scheduled" | "ended">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<"all" | "timed" | "live">("all");

  const items = useMemo(() => {
    return auctions.map((a) => ({
      ...a,
      displayState: getAuctionState(a),
    }));
  }, [auctions]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      live: items.filter((i) => i.displayState === "live").length,
      scheduled: items.filter((i) => i.displayState === "scheduled").length,
      ended: items.filter((i) => i.displayState === "ended").length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      // Tab filter
      if (activeTab === "live" && item.displayState !== "live") return false;
      if (activeTab === "scheduled" && item.displayState !== "scheduled") return false;
      if (activeTab === "ended" && item.displayState !== "ended") return false;

      // Mode filter
      if (selectedMode !== "all" && item.auction_mode !== selectedMode) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = (item.description ?? "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [items, activeTab, selectedMode, searchQuery]);

  return (
    <div>
      {/* Filter and Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`filter-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            Semua ({counts.all})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            Sedang Live ({counts.live})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "scheduled" ? "active" : ""}`}
            onClick={() => setActiveTab("scheduled")}
          >
            Segera Dimulai ({counts.scheduled})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "ended" ? "active" : ""}`}
            onClick={() => setActiveTab("ended")}
          >
            Selesai ({counts.ended})
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexGrow: 1, justifyContent: "flex-end", maxWidth: 480 }}>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as "all" | "timed" | "live")}
            aria-label="Filter berdasarkan mode lelang"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text-main)",
            }}
          >
            <option value="all">Semua Mode</option>
            <option value="timed">Timed Auction</option>
            <option value="live">Live Event</option>
          </select>

          <input
            type="search"
            placeholder="Cari barang lelang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari barang lelang"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 14px",
              fontSize: 12,
              color: "var(--text-main)",
              minWidth: 180,
              flexGrow: 1,
            }}
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="catalog-grid">
          {filtered.map((auction, idx) => (
            <article key={auction.id} className="card-framer">
              <Link href={`/lelang/${auction.id}`} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* Artwork */}
                <div className="artwork-container">
                  {auction.image_url ? (
                    <img
                      src={auction.image_url}
                      alt={auction.title}
                      loading="lazy"
                      className="artwork-img"
                    />
                  ) : (
                    <div className="artwork-fallback">
                      <div className="monogram">TMD.</div>
                      <div className="sub">AUCTION HOUSE</div>
                    </div>
                  )}

                  <div style={{ position: "absolute", top: 12, left: 12 }}>
                    <StatusBadge state={auction.displayState} />
                  </div>

                  <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                    <ModeBadge mode={auction.auction_mode} />
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-muted)" }}>
                      LOT {String(idx + 1).padStart(3, "0")}
                    </span>
                    {auction.displayState === "live" && auction.ends_at && (
                      <Countdown targetDate={auction.ends_at} labelPrefix="Batas" />
                    )}
                  </div>

                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      lineHeight: 1.35,
                      letterSpacing: "-0.02em",
                      marginBottom: 8,
                      minHeight: 46,
                      color: "var(--text-main)",
                    }}
                  >
                    {auction.title}
                  </h3>

                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--text-muted)",
                      marginBottom: 18,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {auction.description || "Buka detail lelang untuk informasi spesifikasi barang dan jadwal penawaran."}
                  </p>

                  <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                          {auction.displayState === "scheduled" ? "HARGA AWAL" : "PENAWARAN TERTINGGI"}
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: 19,
                            fontWeight: 800,
                            color: "var(--gold)",
                            letterSpacing: "-0.02em",
                            marginTop: 4,
                          }}
                        >
                          {rupiah(auction.current_price ?? auction.starting_price)}
                        </div>
                      </div>

                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--gold)",
                          fontSize: 14,
                        }}
                      >
                        ↗
                      </div>
                    </div>

                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
                      {auction.displayState === "scheduled"
                        ? `Mulai: ${formatDateWIB(auction.starts_at)}`
                        : `Berakhir: ${formatDateWIB(auction.ends_at)}`}
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <div style={{ fontSize: 32, color: "var(--gold)", marginBottom: 8 }}>◈</div>
          <h3 className="empty-title">Tidak ada lot yang sesuai</h3>
          <p className="empty-desc">
            Tidak ditemukan barang lelang untuk filter yang dipilih. Coba ganti kata kunci pencarian atau pilih tab filter lainnya.
          </p>
        </div>
      )}
    </div>
  );
}
