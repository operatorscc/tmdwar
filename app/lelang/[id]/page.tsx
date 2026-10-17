import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { type Auction } from "@/lib/auction";
import { AuctionLiveView, type BidRecord } from "./auction-live-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auction } = await supabase
      .from("auctions")
      .select("title, description")
      .is("archived_at", null)
      .eq("id", id)
      .maybeSingle();

    if (auction) {
      return {
        title: `${auction.title} — TMD-WAR Lelang`,
        description: auction.description || "Lihat detail lot dan ajukan penawaran di TMD-WAR.",
      };
    }
  } catch {
    // fallback
  }

  return {
    title: "Detail Lot Lelang — TMD-WAR",
  };
}

interface RawBidData {
  id: number;
  amount: number;
  created_at: string;
  bidder_name: string;
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const archiveAwareResult = await supabase
    .from("auctions")
    .select("id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_at, updated_at, archived_at")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  // Keep detail pages working on preview deployments before the archive migration.
  // Only retry when PostgreSQL explicitly says the archive column does not exist.
  const legacyResult =
    archiveAwareResult.error?.code === "42703" &&
    /archived_at/.test(archiveAwareResult.error.message)
      ? await supabase
          .from("auctions")
          .select("id, title, description, image_url, auction_mode, status, starting_price, current_price, min_increment, starts_at, ends_at, created_at, updated_at")
          .eq("id", id)
          .maybeSingle()
      : null;

  const auctionError = legacyResult ? legacyResult.error : archiveAwareResult.error;
  const auctionData = legacyResult ? legacyResult.data : archiveAwareResult.data;

  if (auctionError || !auctionData) {
    notFound();
  }

  // Archived rows are excluded by the archive-aware query and by RLS after migration.
  const auction = auctionData as unknown as Auction;
  if (!["scheduled", "live", "ended", "cancelled"].includes(auction.status)) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bidsData, error: bidsError } = await supabase
    .from("public_bid_feed")
    .select("id, amount, created_at, bidder_name")
    .eq("auction_id", id)
    .order("amount", { ascending: false })
    .limit(20);

  if (bidsError) {
    console.error("[Auction detail] Failed to load public bid feed:", bidsError.message);
  }

  const rawBids = (bidsData ?? []) as unknown as RawBidData[];

  const initialBids: BidRecord[] = rawBids.map((bid) => ({
    id: bid.id,
    amount: bid.amount,
    created_at: bid.created_at,
    bidder_name: bid.bidder_name || "Peserta",
  }));

  const userSummary = user ? { id: user.id, email: user.email } : null;

  return (
    <div className="app-container" style={{ paddingTop: 28 }}>
      {/* Breadcrumb / Back button */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <Link
          href="/#katalog"
          className="btn-secondary"
          style={{ padding: "8px 14px", fontSize: 12, display: "inline-flex", gap: 6 }}
        >
          <span>←</span>
          <span>Kembali ke Katalog Lelang</span>
        </Link>
      </nav>

      <AuctionLiveView
        initialAuction={auction}
        initialBids={initialBids}
        user={userSummary}
      />
    </div>
  );
}
