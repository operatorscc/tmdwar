import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateAuctionInput } from "../lib/validation.ts";

const baseInput = {
  title: "Lot Uji Waktu",
  description: "Pengujian normalisasi waktu lelang.",
  auctionMode: "timed",
  status: "scheduled",
  startingPrice: "100000",
  minIncrement: "10000",
  startsAt: "2026-12-01T10:00:00",
  endsAt: "2026-12-02T10:00:00",
};

describe("Auction date timezone normalization", () => {
  it("interprets datetime-local values as WIB (UTC+07:00)", () => {
    const result = validateAuctionInput(baseInput);

    assert.equal(result.valid, true, result.errors.join(", "));
    assert.equal(result.sanitized.startsAt, "2026-12-01T03:00:00.000Z");
    assert.equal(result.sanitized.endsAt, "2026-12-02T03:00:00.000Z");
  });

  it("preserves an explicit UTC timezone", () => {
    const result = validateAuctionInput({
      ...baseInput,
      startsAt: "2026-12-01T10:00:00Z",
      endsAt: "2026-12-02T10:00:00Z",
    });

    assert.equal(result.valid, true, result.errors.join(", "));
    assert.equal(result.sanitized.startsAt, "2026-12-01T10:00:00.000Z");
    assert.equal(result.sanitized.endsAt, "2026-12-02T10:00:00.000Z");
  });

  it("rejects an invalid calendar date", () => {
    const result = validateAuctionInput({
      ...baseInput,
      startsAt: "2026-02-30T10:00:00",
      endsAt: "2026-03-02T10:00:00",
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("valid date")));
  });
});
