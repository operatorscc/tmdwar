"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/money";
import { calculateMinBid, validateBid } from "@/lib/auction";

interface BidFormProps {
  auctionId: string;
  currentPrice: number;
  startingPrice: number;
  minIncrement: number;
  onBidSuccess?: (newAmount: number) => void;
}

export default function BidForm({
  auctionId,
  currentPrice,
  startingPrice,
  minIncrement,
  onBidSuccess,
}: BidFormProps) {
  const minRequired = calculateMinBid(currentPrice, startingPrice, minIncrement);
  const [amount, setAmount] = useState<string>(String(minRequired));
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // If current price changes (e.g. from realtime update), ensure input is at least minRequired
  useEffect(() => {
    const curVal = Number(amount);
    if (!curVal || curVal < minRequired) {
      setAmount(String(minRequired));
    }
  }, [minRequired, amount]);

  function setQuickIncrement(multiplier: number) {
    const newTarget = (currentPrice > 0 ? currentPrice : startingPrice) + minIncrement * multiplier;
    setAmount(String(newTarget));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const numericAmount = Number(amount);
    const validation = validateBid(numericAmount, currentPrice, startingPrice, minIncrement);

    if (!validation.valid) {
      setMessage({ text: validation.error || "Nominal bid tidak valid.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("place_bid", {
        p_auction_id: auctionId,
        p_amount: numericAmount,
      });

      if (error) {
        setMessage({ text: error.message, type: "error" });
      } else {
        setMessage({
          text: `Penawaran ${rupiah(numericAmount)} berhasil diterima!`,
          type: "success",
        });
        if (onBidSuccess) {
          onBidSuccess(numericAmount);
        }
        // Advance default to next required
        const nextMin = numericAmount + minIncrement;
        setAmount(String(nextMin));
        router.refresh();
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Terjadi kesalahan jaringan saat mengirim bid.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      <div className="form-field">
        <label htmlFor="bid-amount" className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Nominal Penawaran (IDR)</span>
          <span style={{ color: "var(--gold)", fontSize: 11 }}>
            Minimal: {rupiah(minRequired)}
          </span>
        </label>

        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Rp
          </span>
          <input
            id="bid-amount"
            type="number"
            min={minRequired}
            step={minIncrement}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setMessage(null);
            }}
            required
            className="form-input tabular-nums"
            style={{ paddingLeft: 42, fontSize: 16, fontWeight: 700 }}
            placeholder={String(minRequired)}
          />
        </div>
      </div>

      {/* Quick Bid Pills */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          Pilihan cepat kenaikan bid:
        </div>
        <div className="quick-bids">
          <button
            type="button"
            className="quick-bid-btn"
            onClick={() => setQuickIncrement(1)}
          >
            +1x Min ({rupiah(minIncrement)})
          </button>
          <button
            type="button"
            className="quick-bid-btn"
            onClick={() => setQuickIncrement(2)}
          >
            +2x Min ({rupiah(minIncrement * 2)})
          </button>
          <button
            type="button"
            className="quick-bid-btn"
            onClick={() => setQuickIncrement(5)}
          >
            +5x Min ({rupiah(minIncrement * 5)})
          </button>
          <button
            type="button"
            className="quick-bid-btn"
            onClick={() => setQuickIncrement(10)}
          >
            +10x Min ({rupiah(minIncrement * 10)})
          </button>
        </div>
      </div>

      {message && (
        <div className={message.type === "success" ? "alert-success" : "alert-error"} role="alert">
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary"
        style={{ width: "100%", padding: "14px 20px", fontSize: 14, fontWeight: 800 }}
      >
        {isSubmitting ? "Memproses Penawaran..." : `Ajukan Penawaran ${rupiah(Number(amount) || minRequired)}`}
      </button>

      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 12 }}>
        Setiap penawaran mengikat dan disimpan permanen dalam buku lelang. Pembayaran akan ditagihkan kepada penawar tertinggi saat penutupan.
      </p>
    </form>
  );
}
