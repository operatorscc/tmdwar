import React from "react";
import type { DisplayAuctionState, AuctionMode } from "@/lib/auction";

interface StatusBadgeProps {
  state: DisplayAuctionState;
  className?: string;
}

export function StatusBadge({ state, className = "" }: StatusBadgeProps) {
  if (state === "live") {
    return (
      <span className={`badge badge-live ${className}`}>
        <span className="pulse-dot" aria-hidden="true" />
        Lelang Berlangsung
      </span>
    );
  }

  if (state === "scheduled") {
    return (
      <span className={`badge badge-sched ${className}`}>
        Segera Dimulai
      </span>
    );
  }

  if (state === "cancelled") {
    return (
      <span className={`badge badge-ended ${className}`}>
        Dibatalkan
      </span>
    );
  }

  return (
    <span className={`badge badge-ended ${className}`}>
      Lelang Selesai
    </span>
  );
}

export function ModeBadge({ mode, className = "" }: { mode: AuctionMode; className?: string }) {
  return (
    <span className={`badge badge-mode ${className}`}>
      {mode === "live" ? "Live Event" : "Timed Auction"}
    </span>
  );
}
