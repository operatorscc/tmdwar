import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateAuctionInput, validateImage, generateStoragePath, requireAdmin } from "../lib/validation.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────
const validInput = {
  title: "Kamera Analog Leica M6",
  description: "Kondisi mint, lengkap dengan box",
  auctionMode: "timed",
  status: "draft",
  startingPrice: "15000000",
  minIncrement: "250000",
  startsAt: "2026-12-01T10:00:00",
  endsAt: "2026-12-07T22:00:00",
};

// ─── validateAuctionInput ───────────────────────────────────────────────────
describe("Auction Input Validation", () => {
  test("accepts valid input with all fields correct", () => {
    const result = validateAuctionInput(validInput);
    assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(", ")}`);
    assert.equal(result.sanitized.title, "Kamera Analog Leica M6");
    assert.equal(result.sanitized.auctionMode, "timed");
    assert.equal(result.sanitized.status, "draft");
  });

  test("rejects title shorter than 3 characters", () => {
    const result = validateAuctionInput({ ...validInput, title: "AB" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Title")));
  });

  test("rejects title longer than 160 characters", () => {
    const result = validateAuctionInput({ ...validInput, title: "A".repeat(161) });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Title")));
  });

  test("rejects negative starting price", () => {
    const result = validateAuctionInput({ ...validInput, startingPrice: "-100" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Starting price")));
  });

  test("rejects zero or negative min increment", () => {
    const result = validateAuctionInput({ ...validInput, minIncrement: "0" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Minimum increment")));
  });

  test("rejects non-integer starting price", () => {
    const result = validateAuctionInput({ ...validInput, startingPrice: "100.5" });
    assert.ok(!result.valid);
  });

  test("rejects end time before start time", () => {
    const result = validateAuctionInput({
      ...validInput,
      startsAt: "2026-12-07T22:00:00",
      endsAt: "2026-12-01T10:00:00",
    });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("End time")));
  });

  test("rejects missing start time", () => {
    const result = validateAuctionInput({ ...validInput, startsAt: "" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Start time")));
  });

  test("rejects invalid auction mode", () => {
    const result = validateAuctionInput({ ...validInput, auctionMode: "invalid" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("mode")));
  });

  test("rejects invalid status", () => {
    const result = validateAuctionInput({ ...validInput, status: "invalid" });
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.includes("Status")));
  });

  test("trims whitespace from title and description", () => {
    const result = validateAuctionInput({
      ...validInput,
      title: "  Trimmed Title  ",
      description: "  Trimmed description  ",
    });
    assert.ok(result.valid);
    assert.equal(result.sanitized.title, "Trimmed Title");
    assert.equal(result.sanitized.description, "Trimmed description");
  });

  test("accepts all valid statuses", () => {
    for (const status of ["draft", "scheduled", "live", "ended", "cancelled"]) {
      const result = validateAuctionInput({ ...validInput, status });
      assert.ok(result.valid, `Status "${status}" should be valid`);
    }
  });

  test("accepts both valid auction modes", () => {
    for (const mode of ["timed", "live"]) {
      const result = validateAuctionInput({ ...validInput, auctionMode: mode });
      assert.ok(result.valid, `Mode "${mode}" should be valid`);
    }
  });
});

// ─── validateImage ──────────────────────────────────────────────────────────
describe("Image Validation", () => {
  test("accepts null or empty file", () => {
    assert.ok(validateImage(null).valid);
    assert.ok(validateImage({ size: 0, type: "" } as File).valid);
  });

  test("accepts JPEG, PNG, and WebP within size limit", () => {
    const smallFile = { size: 1024, type: "image/jpeg" } as File;
    assert.ok(validateImage(smallFile).valid);
    const pngFile = { size: 1024, type: "image/png" } as File;
    assert.ok(validateImage(pngFile).valid);
    const webpFile = { size: 1024, type: "image/webp" } as File;
    assert.ok(validateImage(webpFile).valid);
  });

  test("rejects unsupported image types", () => {
    const gifFile = { size: 1024, type: "image/gif" } as File;
    const result = validateImage(gifFile);
    assert.ok(!result.valid);
    assert.ok(result.error?.includes("Unsupported"));
  });

  test("rejects files exceeding 5MB", () => {
    const largeFile = { size: 6 * 1024 * 1024, type: "image/jpeg" } as File;
    const result = validateImage(largeFile);
    assert.ok(!result.valid);
    assert.ok(result.error?.includes("5 MB"));
  });
});

// ─── generateStoragePath ────────────────────────────────────────────────────
describe("Storage Path Generation", () => {
  test("generates a path with the correct extension", () => {
    const file = { name: "photo.JPEG" } as File;
    const path = generateStoragePath(file);
    assert.match(path, /\.jpeg$/i);
  });

  test("defaults to jpg when no extension", () => {
    const file = { name: "noextension" } as File;
    const path = generateStoragePath(file);
    assert.match(path, /\.jpg$/);
  });

  test("generates unique paths", () => {
    const file = { name: "photo.png" } as File;
    const path1 = generateStoragePath(file);
    const path2 = generateStoragePath(file);
    assert.notEqual(path1, path2);
  });
});

// ─── requireAdmin ───────────────────────────────────────────────────────────
describe("Admin Authorization (requireAdmin)", () => {
  test("returns isAdmin=true when RPC returns true", async () => {
    const mockSupabase = {
      rpc: async () => ({ data: true, error: null }),
    };
    const result = await requireAdmin(mockSupabase);
    assert.ok(result.isAdmin);
    assert.equal(result.error, undefined);
  });

  test("returns isAdmin=false when RPC returns false", async () => {
    const mockSupabase = {
      rpc: async () => ({ data: false, error: null }),
    };
    const result = await requireAdmin(mockSupabase);
    assert.ok(!result.isAdmin);
    assert.ok(result.error?.includes("admin"));
  });

  test("returns error when RPC returns an error", async () => {
    const mockSupabase = {
      rpc: async () => ({ data: null, error: { message: "RPC failed" } }),
    };
    const result = await requireAdmin(mockSupabase);
    assert.ok(!result.isAdmin);
    assert.ok(result.error?.includes("Failed"));
  });
});
