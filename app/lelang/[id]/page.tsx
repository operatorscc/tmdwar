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
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auctionData, error: auctionError } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (auctionError || !auctionData) {
    notFound();
  }

  const auction = auctionData as unknown as Auction;
  if (!["scheduled", "live", "ended", "cancelled"].includes(auction.status)) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bidsData } = await supabase
    .from("bids")
    .select("id, amount, created_at, profiles(display_name)")
    .eq("auction_id", id)
    .order("amount", { ascending: false })
    .limit(20);

  const rawBids = (bidsData ?? []) as unknown as RawBidData[];

  const initialBids: BidRecord[] = rawBids.map((b) => {
    let name = "Peserta";
    if (b.profiles) {
      if (Array.isArray(b.profiles)) {
        name = b.profiles[0]?.display_name || "Peserta";
      } else {
        name = b.profiles.display_name || "Peserta";
      }
    }
    return {
      id: b.id,
      amount: b.amount,
      created_at: b.created_at,
      bidder_name: name,
    };
  });

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
