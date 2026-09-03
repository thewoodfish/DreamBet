"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchLatestPrices,
  fetchPriceHistory,
  type PricePoint,
} from "@/lib/dreamdex/oracle";
import type { Asset } from "@/lib/assets";

/** Points held in the trend line — one per minute, so the last hour. */
export const HISTORY_LENGTH = 60;

/**
 * How often we look for a new print. The oracle publishes once a minute, so
 * this is oversampled on purpose: it costs one small query and means a new
 * price shows up within seconds of being posted rather than up to a minute.
 */
const POLL_MS = 15_000;

/** How long the price stays tinted after a new print before settling back. */
const FLASH_MS = 420;

export interface PriceFeed {
  /** Latest oracle print, or null before the first read lands. */
  price: number | null;
  /** Rolling window of the last hour, oldest first. */
  history: number[];
  /** Percentage move across the visible window. */
  changePct: number;
  /**
   * Direction of the most recent print, cleared shortly after. A transient
   * flash only — the resting colour is white, so it never contradicts the
   * window's overall change badge.
   */
  flash: "up" | "down" | null;
  loading: boolean;
}

/**
 * The asset's real price history, read from the oracle.
 *
 * There is no separate price API on the venue, but there does not need to be:
 * markets on the 1-minute series are created with their strike set to the
 * feed's spot at that moment, so reading a run of them back *is* the oracle's
 * own minute-by-minute history — and it is denominated exactly as the 15-minute
 * windows settle, which a simulated walk could never guarantee.
 */
export function usePriceFeed(asset: Asset): PriceFeed {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ dir: "up" | "down" | null; id: number }>({
    dir: null,
    id: 0,
  });

  // Compared against each poll to notice a genuinely new print, rather than
  // re-flashing every time the same latest price is fetched again.
  const latestAt = useRef(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setPoints([]);
    latestAt.current = 0;

    function absorb(incoming: PricePoint[]) {
      if (!live || incoming.length === 0) return;

      setPoints((prev) => {
        const byTime = new Map(prev.map((p) => [p.t, p.price]));
        for (const p of incoming) byTime.set(p.t, p.price);

        const merged = Array.from(byTime, ([t, price]) => ({ t, price }))
          .sort((a, b) => a.t - b.t)
          .slice(-HISTORY_LENGTH);

        const newest = merged[merged.length - 1];
        const previous = merged[merged.length - 2];

        // Only a print we have not seen before is worth flashing.
        if (newest && newest.t > latestAt.current) {
          const first = latestAt.current === 0;
          latestAt.current = newest.t;
          if (!first && previous) {
            setFlash((f) => ({
              dir:
                newest.price > previous.price
                  ? "up"
                  : newest.price < previous.price
                    ? "down"
                    : null,
              id: f.id + 1,
            }));
          }
        }

        return merged;
      });
    }

    async function initial() {
      try {
        absorb(await fetchPriceHistory(asset.symbol, HISTORY_LENGTH));
      } catch {
        // Leave the chart empty; the poll below will fill it in when the
        // indexer comes back rather than showing invented prices.
      } finally {
        if (live) setLoading(false);
      }
    }

    async function poll() {
      try {
        absorb(await fetchLatestPrices(asset.symbol));
      } catch {
        // A dropped poll just means no new print this time.
      }
    }

    initial();
    const id = setInterval(poll, POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [asset.symbol]);

  // Clear the tint a beat after each print. Keyed on `id` so back-to-back moves
  // in the same direction each get their own full flash.
  useEffect(() => {
    if (flash.dir === null) return;
    const timer = setTimeout(
      () => setFlash((f) => (f.id === flash.id ? { ...f, dir: null } : f)),
      FLASH_MS
    );
    return () => clearTimeout(timer);
  }, [flash.id, flash.dir]);

  const history = points.map((p) => p.price);
  const price = history.length > 0 ? history[history.length - 1] : null;
  const open = history.length > 0 ? history[0] : 0;
  const changePct =
    price === null || open === 0 ? 0 : ((price - open) / open) * 100;

  return { price, history, changePct, flash: flash.dir, loading };
}
