/**
 * Shared auction (product) validation logic.
 * Used by API routes, server actions, and client-side form validation.
 */

import type { AuctionStatus, AuctionMode } from "./auction";

export interface AuctionInput {
  title: string;
  description: string;
  auctionMode: string;
  status: string;
  startingPrice: string;
  minIncrement: string;
  startsAt: string;
  endsAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: {
    title: string;
    description: string;
    auctionMode: AuctionMode;
    status: AuctionStatus;
    startingPrice: string;
    minIncrement: string;
    startsAt: string;
    endsAt: string;
  };
}

const VALID_MODES: AuctionMode[] = ["timed", "live"];
const VALID_STATUSES: AuctionStatus[] = ["draft", "scheduled", "live", "ended", "cancelled"];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates an image file for type and size.
 */
export function validateImage(file: File | null): { valid: boolean; error?: string } {
  if (!file || file.size === 0) return { valid: true };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "Unsupported image type. Use JPEG, PNG, or WebP." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image size exceeds 5 MB limit." };
  }
  return { valid: true };
}

/**
 * Validates auction form input fields.
 * Returns a list of errors and a sanitized copy of the input.
 */
export function validateAuctionInput(input: AuctionInput): ValidationResult {
  const errors: string[] = [];

  const title = (input.title || "").trim();
  const description = (input.description || "").trim();
  const auctionMode = input.auctionMode || "timed";
  const status = input.status || "draft";
  const startingPriceStr = input.startingPrice || "0";
  const minIncrementStr = input.minIncrement || "0";
  const startsAt = input.startsAt || "";
  const endsAt = input.endsAt || "";

  // Title validation (matches schema CHECK constraint)
  if (title.length < 3 || title.length > 160) {
    errors.push("Title must be between 3 and 160 characters.");
  }

  // Mode validation
  if (!VALID_MODES.includes(auctionMode as AuctionMode)) {
    errors.push("Auction mode must be 'timed' or 'live'.");
  }

  // Status validation
  if (!VALID_STATUSES.includes(status as AuctionStatus)) {
    errors.push("Status must be one of: draft, scheduled, live, ended, cancelled.");
  }

  // Price validation — must be non-negative integers
  const startingPrice = Number(startingPriceStr);
  const minIncrement = Number(minIncrementStr);

  if (!Number.isFinite(startingPrice) || !Number.isSafeInteger(startingPrice) || startingPrice < 0) {
    errors.push("Starting price must be a non-negative integer.");
  }
  if (!Number.isFinite(minIncrement) || !Number.isSafeInteger(minIncrement) || minIncrement <= 0) {
    errors.push("Minimum increment must be a positive integer.");
  }

  // Date validation
  if (!startsAt) {
    errors.push("Start time is required.");
  }
  if (!endsAt) {
    errors.push("End time is required.");
  }
  if (startsAt && endsAt) {
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime())) {
      errors.push("Start time is not a valid date.");
    }
    if (Number.isNaN(endDate.getTime())) {
      errors.push("End time is not a valid date.");
    }
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate <= startDate) {
      errors.push("End time must be after start time.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      title,
      description,
      auctionMode: auctionMode as AuctionMode,
      status: status as AuctionStatus,
      startingPrice: startingPriceStr,
      minIncrement: minIncrementStr,
      startsAt,
      endsAt,
    },
  };
}

/**
 * Generates a safe random filename for storage uploads.
 * Uses crypto.randomUUID() (no external dependency).
 */
export function generateStoragePath(file: File): string {
  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
  const safeExt = ext.length <= 5 && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${uuid}.${safeExt}`;
}

/**
 * Validates that the caller has admin privileges via Supabase RPC.
 */
export async function requireAdmin(
  supabase: { rpc: (fn: string) => PromiseLike<{ data: boolean | null; error: { message: string } | null }> }
): Promise<{ isAdmin: boolean; error?: string }> {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    return { isAdmin: false, error: "Failed to verify admin role." };
  }
  if (!isAdmin) {
    return { isAdmin: false, error: "Only admin users can perform this action." };
  }
  return { isAdmin: true };
}
