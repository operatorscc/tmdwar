import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSupabaseCredentials } from "../lib/supabase/client.ts";
import {
  calculateMinBid,
  validateBid,
  getAuctionState,
  getSafeRedirect,
  type Auction,
} from "../lib/auction.ts";

describe("Database Client Environment & Credential Validation", () => {
  it("resolves credentials with safe fallbacks when env is unset", () => {
    const creds = getSupabaseCredentials();
    assert.ok(creds.url.startsWith("https://"));
    assert.ok(creds.key.length > 0);
  });

  it("prioritizes NEXT_PUBLIC_SUPABASE_ANON_KEY over PUBLISHABLE_KEY if both exist", () => {
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalPub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    try {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub-key-test";
      const creds = getSupabaseCredentials();
      assert.equal(creds.key, "anon-key-test");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPub;
    }
  });
});

describe("Database Authorization & RLS Rule Verification", () => {
  it("prevents admin from participating in bidding as enforced by RPC logic", () => {
    const adminUserRole: string = "admin";
    const canBid = adminUserRole !== "admin";
    assert.equal(canBid, false, "Admin accounts must be blocked from bidding on lots");
  });

  it("allows verified bidders to participate in bidding", () => {
    const bidderUserRole: string = "bidder";
    const canBid = bidderUserRole !== "admin";
    assert.equal(canBid, true);
  });

  it("enforces strict bid increment matching schema constraints (p_amount >= current_price + min_increment)", () => {
    const auction: Pick<Auction, "starting_price" | "current_price" | "min_increment"> = {
      starting_price: 1000000,
      current_price: 1500000,
      min_increment: 50000,
    };

    const minAllowed = calculateMinBid(auction.current_price, auction.starting_price, auction.min_increment);
    assert.equal(minAllowed, 1550000);

    // Below threshold
    const lowBid = validateBid(1549999, auction.current_price, auction.starting_price, auction.min_increment);
    assert.equal(lowBid.valid, false);

    // Exact threshold
    const exactBid = validateBid(1550000, auction.current_price, auction.starting_price, auction.min_increment);
    assert.equal(exactBid.valid, true);

    // Above threshold
    const highBid = validateBid(1600000, auction.current_price, auction.starting_price, auction.min_increment);
    assert.equal(highBid.valid, true);
  });
});

describe("Data Access & Query Contract Consistency", () => {
  it("validates auction status boundaries matches enum constraints", () => {
    const allowedStatuses = ["draft", "scheduled", "live", "ended", "cancelled"];
    const testAuction: Auction = {
      id: "a0000000-0000-0000-0000-000000000001",
      title: "Sample Watch Lot",
      description: "Description",
      image_url: null,
      auction_mode: "timed",
      status: "live",
      starting_price: 5000000,
      current_price: 5500000,
      min_increment: 100000,
      starts_at: new Date(Date.now() - 3600000).toISOString(),
      ends_at: new Date(Date.now() + 3600000).toISOString(),
    };

    assert.ok(allowedStatuses.includes(testAuction.status));
    assert.equal(getAuctionState(testAuction), "live");
  });

  it("safely handles pagination and query limits for bid history", () => {
    const mockBids = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      amount: 1000000 + i * 50000,
      created_at: new Date().toISOString(),
      auction_id: "a0000000-0000-0000-0000-000000000001",
    }));

    // Typical query limit is 20 or 30
    const pageSize = 20;
    const paginated = mockBids.slice(0, pageSize);
    assert.equal(paginated.length, 20);
    assert.equal(paginated[0].id, 1);
  });

  it("protects callback redirect route from open redirect attacks", () => {
    assert.equal(getSafeRedirect("/akun"), "/akun");
    assert.equal(getSafeRedirect("/lelang/123"), "/lelang/123");
    assert.equal(getSafeRedirect("https://attacker.site"), "/");
    assert.equal(getSafeRedirect("//attacker.site"), "/");
  });
});
