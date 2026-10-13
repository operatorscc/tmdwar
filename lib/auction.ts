export type AuctionStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type AuctionMode = "timed" | "live";

export interface Auction {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  auction_mode: AuctionMode;
  status: AuctionStatus;
  starting_price: number;
  current_price: number | null;
  min_increment: number;
  starts_at: string | null;
  ends_at: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type DisplayAuctionState = "scheduled" | "live" | "ended" | "cancelled";

/**
 * Derives the active display state of an auction based on status and time boundaries.
 */
export function getAuctionState(
  auction: Pick<Auction, "status" | "starts_at" | "ends_at">,
  currentTimeMs: number = Date.now()
): DisplayAuctionState {
  if (auction.status === "cancelled") return "cancelled";
  if (auction.status === "ended") return "ended";

  const startMs = auction.starts_at ? new Date(auction.starts_at).getTime() : null;
  const endMs = auction.ends_at ? new Date(auction.ends_at).getTime() : null;

  if (endMs !== null && Number.isFinite(endMs) && currentTimeMs >= endMs) {
    return "ended";
  }

  if (auction.status === "scheduled") {
    if (startMs === null || !Number.isFinite(startMs) || currentTimeMs < startMs) {
      return "scheduled";
    }
  }

  // If time has elapsed past ends_at, mark ended
  if (startMs !== null && currentTimeMs < startMs) {
    return "scheduled";
  }

  return "live";
}

/**
 * Returns formatted date in Jakarta (WIB) timezone.
 */
export function formatDateWIB(value: string | null | undefined): string {
  if (!value) return "Jadwal belum ditentukan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jadwal belum ditentukan";

  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB"
  );
}

/**
 * Calculates remaining time until target date string.
 */
export function getTimeRemaining(targetDateStr: string | null | undefined, nowMs: number = Date.now()) {
  if (!targetDateStr) {
    return { isExpired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: "00:00:00" };
  }
  const targetMs = new Date(targetDateStr).getTime();
  if (Number.isNaN(targetMs) || targetMs <= nowMs) {
    return { isExpired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: "Selesai" };
  }

  const diffMs = targetMs - nowMs;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatted =
    days > 0
      ? `${days}h ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { isExpired: false, totalMs: diffMs, days, hours, minutes, seconds, formatted };
}

/**
 * Computes minimum next bid amount.
 */
export function calculateMinBid(currentPrice: number | null | undefined, startingPrice: number, minIncrement: number): number {
  const base = currentPrice != null && currentPrice > 0 ? currentPrice : startingPrice;
  return base + minIncrement;
}

/**
 * Validates whether proposed bid is legitimate.
 */
export function validateBid(
  amount: number,
  currentPrice: number | null | undefined,
  startingPrice: number,
  minIncrement: number
): { valid: boolean; minRequired: number; error?: string } {
  const minRequired = calculateMinBid(currentPrice, startingPrice, minIncrement);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(amount) || amount <= 0) {
    return { valid: false, minRequired, error: "Nominal penawaran harus berupa bilangan bulat positif." };
  }
  if (amount < minRequired) {
    return { valid: false, minRequired, error: `Penawaran minimal adalah Rp ${minRequired.toLocaleString("id-ID")}.` };
  }
  return { valid: true, minRequired };
}

/**
 * Sanitizes redirect target URL to prevent Open Redirect attacks.
 */
export function getSafeRedirect(nextParam: string | null | undefined, fallback: string = "/"): string {
  if (!nextParam) return fallback;
  if (nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.includes("://")) {
    return nextParam;
  }
  return fallback;
}
