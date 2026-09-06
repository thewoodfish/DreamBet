"use client";

import { useEffect, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { STRIKE_SCALE } from "@/lib/dreamdex/config";
import { resolvedDirection, toDreamdexMarket } from "@/lib/dreamdex/market";
import type { Direction } from "@/lib/round";

/**
 * How often a closed window is checked for its verdict. The oracle posts within
 * a few seconds of expiry, and this is the one moment the user is actively
 * waiting on an answer, so it polls faster than anything else in the app.
 */
const POLL_MS = 3_000;

export interface Settlement {
  /** The side the contract paid out. Null on a void — nobody was wrong. */
  winner: Direction | null;
  /** The price it settled at, or null if the oracle posted no number. */
  price: number | null;
  voided: boolean;
}

/**
 * Waits for a specific window to resolve and reports what the contract decided.
 *
 * The verdict is read off the market rather than recomputed here. Comparing a
 * locally-held price against a locally-held strike would agree with the chain
 * almost always — and the times it disagreed would be exactly the times a user
 * had money on it.
 */
export function useSettlement(marketId: `0x${string}` | null): Settlement | null {
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    setSettlement(null);
    if (!marketId) return;

    let live = true;

    async function read() {
      try {
        const raw = await exchange.client.getMarket(marketId as string);
        if (!live || !raw || raw.marketType !== "BINARY") return;

        const market = toDreamdexMarket(raw);
        const winner = resolvedDirection(market);

        // Still open, or resolved but with no one-hot winner yet. Either way
        // there is nothing to show, so keep waiting rather than guessing.
        if (winner === null && !market.voided) return;

        const prices = await exchange.client.getResolutionPrices([
          market.marketId,
        ]);
        const raw_price = prices[market.marketId.toLowerCase()];
        if (!live) return;

        setSettlement({
          winner,
          price: raw_price === null ? null : Number(raw_price) / STRIKE_SCALE,
          voided: market.voided,
        });

        // A settled market stays settled. The watch is held open while the
        // result is on screen, so without this it would go on asking the
        // indexer the same answered question every three seconds.
        clearInterval(timer);
      } catch {
        // Keep polling; a settled market stays settled, so a dropped read only
        // delays the answer.
      }
    }

    // The interval is created before the first read so that read can cancel it
    // the moment it has an answer.
    const timer = setInterval(read, POLL_MS);
    read();

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [marketId]);

  return settlement;
}
