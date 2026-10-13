"use client";

import { useEffect, useState } from "react";
import { getTimeRemaining } from "@/lib/auction";

interface CountdownProps {
  targetDate: string | null | undefined;
  labelPrefix?: string;
  onExpire?: () => void;
  className?: string;
}

export function Countdown({
  targetDate,
  labelPrefix = "Sisa Waktu",
  onExpire,
  className = "",
}: CountdownProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(targetDate));

  useEffect(() => {
    if (!targetDate) return;

    const interval = setInterval(() => {
      const updated = getTimeRemaining(targetDate);
      setRemaining(updated);
      if (updated.isExpired) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  if (!targetDate || remaining.isExpired) {
    return (
      <div className={`tabular-nums ${className}`} style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
        Waktu telah berakhir
      </div>
    );
  }

  return (
    <div className={`tabular-nums ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {labelPrefix && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {labelPrefix}:
        </span>
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
        {remaining.formatted}
      </span>
    </div>
  );
}
