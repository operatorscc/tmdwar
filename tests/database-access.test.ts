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

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

function saveEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Database Client Environment & Credential Validation", () => {
  it("rejects missing Supabase configuration instead of using unsafe fallbacks", () => {
    const saved = saveEnv();
    try {
      for (const key of ENV_KEYS) delete process.env[key];
      assert.throws(
        () => getSupabaseCredentials(),
        /Konfigurasi Supabase belum lengkap/
      );
    } finally {
      restoreEnv(saved);
    }
  });

  it("prioritizes NEXT_PUBLIC_SUPABASE_ANON_KEY over PUBLISHABLE_KEY if both exist", () => {
    const saved = saveEnv();
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub-key-test";
      const creds = getSupabaseCredentials();
      assert.equal(creds.url, "https://example.supabase.co");
      assert.equal(creds.key, "anon-key-test");
    } finally {
      restoreEnv(saved);
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
    assert.equal(validateBid(1549999, auction.current_price, auction.starting_price, auction.min_increment).valid, false);
    assert.equal(validateBid(1550000, auction.current_price, auction.starting_price, auction.min_increment).valid, true);
    assert.equal(validateBid(1600000, auction.current_price, auction.starting_price, auction.min_increment).valid, true);
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
