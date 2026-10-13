import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rupiah } from "../lib/money.ts";
import {
  getAuctionState,
  calculateMinBid,
  validateBid,
  getSafeRedirect,
  getTimeRemaining,
} from "../lib/auction.ts";

describe("Money formatting (rupiah)", () => {
  it("formats standard integer numbers to IDR correctly", () => {
    const formatted = rupiah(1500000);
    assert.match(formatted, /1\.500\.000/);
    assert.ok(formatted.includes("Rp"));
  });

  it("handles 0, null, and undefined safely", () => {
    assert.match(rupiah(0), /0/);
    assert.match(rupiah(null), /0/);
    assert.match(rupiah(undefined), /0/);
  });

  it("handles string representations of numbers", () => {
    assert.match(rupiah("250000"), /250\.000/);
  });

  it("handles invalid non-numeric inputs gracefully", () => {
    assert.equal(rupiah("not-a-number"), "Rp 0");
  });
});

describe("Auction State transitions", () => {
  const fixedNow = 1700000000000; // Reference timestamp

  it("returns cancelled when status is cancelled", () => {
    const state = getAuctionState(
      { status: "cancelled", starts_at: null, ends_at: null },
      fixedNow
    );
    assert.equal(state, "cancelled");
  });

  it("returns ended when status is ended or time past ends_at", () => {
    const pastEnd = new Date(fixedNow - 10000).toISOString();
    const state = getAuctionState(
      { status: "live", starts_at: null, ends_at: pastEnd },
      fixedNow
    );
    assert.equal(state, "ended");
  });

  it("returns scheduled when auction has not reached starts_at", () => {
    const futureStart = new Date(fixedNow + 60000).toISOString();
    const futureEnd = new Date(fixedNow + 120000).toISOString();
    const state = getAuctionState(
      { status: "scheduled", starts_at: futureStart, ends_at: futureEnd },
      fixedNow
    );
    assert.equal(state, "scheduled");
  });

  it("returns live when current time is between starts_at and ends_at", () => {
    const pastStart = new Date(fixedNow - 60000).toISOString();
    const futureEnd = new Date(fixedNow + 60000).toISOString();
    const state = getAuctionState(
      { status: "live", starts_at: pastStart, ends_at: futureEnd },
      fixedNow
    );
    assert.equal(state, "live");
  });
});

describe("Bid calculations and validation", () => {
  it("calculates min bid based on starting price when current price is null or 0", () => {
    assert.equal(calculateMinBid(null, 100000, 10000), 110000);
    assert.equal(calculateMinBid(0, 100000, 10000), 110000);
  });

  it("calculates min bid based on current price when present", () => {
    assert.equal(calculateMinBid(250000, 100000, 25000), 275000);
  });

  it("validates legitimate bids above threshold", () => {
    const result = validateBid(300000, 250000, 100000, 25000);
    assert.equal(result.valid, true);
    assert.equal(result.minRequired, 275000);
    assert.equal(result.error, undefined);
  });

  it("rejects bids below the minimum increment", () => {
    const result = validateBid(260000, 250000, 100000, 25000);
    assert.equal(result.valid, false);
    assert.equal(result.minRequired, 275000);
    assert.ok(result.error?.includes("275.000"));
  });

  it("rejects non-integer, negative, or NaN bids", () => {
    assert.equal(validateBid(-500, 0, 1000, 100).valid, false);
    assert.equal(validateBid(NaN, 0, 1000, 100).valid, false);
    assert.equal(validateBid(1050.5, 0, 1000, 100).valid, false);
  });
});

describe("Time remaining countdown calculations", () => {
  const fixedNow = 1700000000000;

  it("returns expired for null or past dates", () => {
    assert.equal(getTimeRemaining(null, fixedNow).isExpired, true);
    const past = new Date(fixedNow - 5000).toISOString();
    assert.equal(getTimeRemaining(past, fixedNow).isExpired, true);
  });

  it("formats hours, minutes, and seconds properly", () => {
    // 2 hours, 15 minutes, 30 seconds ahead = 8130 seconds = 8130000 ms
    const future = new Date(fixedNow + (2 * 3600 + 15 * 60 + 30) * 1000).toISOString();
    const res = getTimeRemaining(future, fixedNow);
    assert.equal(res.isExpired, false);
    assert.equal(res.hours, 2);
    assert.equal(res.minutes, 15);
    assert.equal(res.seconds, 30);
    assert.equal(res.formatted, "02:15:30");
  });
});

describe("Safe redirect URI verification", () => {
  it("allows relative internal routes", () => {
    assert.equal(getSafeRedirect("/lelang/123"), "/lelang/123");
    assert.equal(getSafeRedirect("/akun"), "/akun");
  });

  it("prevents open redirect attacks with external schemes", () => {
    assert.equal(getSafeRedirect("https://malicious.com"), "/");
    assert.equal(getSafeRedirect("//malicious.com"), "/");
    assert.equal(getSafeRedirect("javascript:alert(1)"), "/");
    assert.equal(getSafeRedirect(null), "/");
  });
});
