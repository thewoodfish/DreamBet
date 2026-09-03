"use client";

import { useEffect, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { APP_CADENCE_SECONDS } from "@/lib/dreamdex/config";
import {
  marketBoundary,
  pickTradableMarket,
  quoteFromProbability,
  toDreamdexMarket,
  type DreamdexMarket,
  type MarketQuote,
} from "@/lib/dreamdex/market";
import type { AssetSymbol } from "@/lib/assets";

/**
 * How often the board is re-read. A 15-minute window does not reprice every
 * second, and the countdown ticks from the clock rather than from a fetch, so
 * this only has to be quick enough to catch the roll into a new window.
 */
const POLL_MS = 8_000;

/** Enough of the board to find this asset's window without paging. */
const PAGE_SIZE = 10;

export interface DreamdexWindow {
  /** The window being traded, or null between one closing and the next opening. */
  market: DreamdexMarket | null;
  /**
   * The line this window settles against — its opening oracle print. Null while
   * the oracle has yet to post it, which is a real state early in a window.
   */
  boundary: number | null;
  /**
   * Odds on offer. Always present, holding the indicative 50/50 before the
   * market resolves — `quote.isIndicative` is what says not to trust it.
   */
  quote: MarketQuote;
  /** True until the first response lands for this asset. */
  loading: boolean;
  error: boolean;
}

/**
 * The event window DreamBet is currently trading for an asset, straight from
 * dreamDEX: which window, what it settles against, and what the book is paying.
 *
 * Everything a punter is shown about the round comes from here, so there is no
 * second, locally-invented version of the round to drift out of step with the
 * contract.
 */
export function useDreamdexWindow(asset: AssetSymbol): DreamdexWindow {
  const [market, setMarket] = useState<DreamdexMarket | null>(null);
  const [boundary, setBoundary] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // A response for the previous asset must not land on the new one — the
    // user switching pills mid-flight would otherwise see BTC's window on ETH.
    let live = true;
    setLoading(true);
    setMarket(null);
    setBoundary(null);

    async function read() {
      try {
        const rows = await exchange.client.listLiveBinaryMarkets({
          asset,
          intervalSec: APP_CADENCE_SECONDS,
          limit: PAGE_SIZE,
        });
        if (!live) return;

        const picked = pickTradableMarket(rows.map(toDreamdexMarket), Date.now());
        setMarket(picked);

        // The opening print is a second query, so it is only worth making once
        // a window has actually been picked.
        if (picked) {
          const raw = rows.find((r) => r.marketId === picked.marketId);
          const opening = await exchange.client.getOpeningPrices([
            picked.marketId,
          ]);
          if (live && raw) setBoundary(marketBoundary(raw, opening));
        } else {
          setBoundary(null);
        }

        if (live) setError(false);
      } catch {
        // Keep the last known window rather than blanking the round mid-flight;
        // a dropped poll is not the same as the window closing.
        if (live) setError(true);
      } finally {
        if (live) setLoading(false);
      }
    }

    read();
    const id = setInterval(read, POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [asset]);

  return {
    market,
    boundary,
    quote: quoteFromProbability(market?.lastProbability ?? null),
    loading,
    error,
  };
}
