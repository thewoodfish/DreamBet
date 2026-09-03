"use client";

import { useEffect, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { APP_CADENCE_SECONDS } from "@/lib/dreamdex/config";
import {
  pickTradableMarket,
  quoteFromProbability,
  toDreamdexMarket,
  type DreamdexMarket,
  type MarketQuote,
} from "@/lib/dreamdex/market";
import type { AssetSymbol } from "@/lib/assets";

/**
 * How often the board is re-read. The quote only moves when someone trades
 * into the book, and a 15m window does not reprice every second, so this is
 * frequent enough to feel live without hammering a shared indexer.
 */
const POLL_MS = 8_000;

/** Enough of the board to find this asset's window without paging. */
const PAGE_SIZE = 10;

export interface DreamdexQuote {
  /** The window being quoted, or null while none is open for this asset. */
  market: DreamdexMarket | null;
  /**
   * Odds on offer. Present even before the market resolves, holding the
   * indicative 50/50 — the buttons need *something* to render, and
   * `quote.isIndicative` is what says not to trust it.
   */
  quote: MarketQuote;
  /** True until the first response lands, for this asset. */
  loading: boolean;
  /** Set when the indexer could not be reached at all. */
  error: boolean;
}

/**
 * Live odds for an asset, straight from the dreamDEX order book.
 *
 * The quote is the market's own last traded price rather than anything this
 * app computes: on a binary market the price of the UP token *is* the implied
 * probability, so the payout a punter sees is its reciprocal. Most short
 * windows have never traded — that is the honest, common case, and it surfaces
 * as `isIndicative` rather than as a made-up number.
 */
export function useDreamdexQuote(asset: AssetSymbol): DreamdexQuote {
  const [market, setMarket] = useState<DreamdexMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // A response for the previous asset must not land on the new one — the
    // user switching pills mid-flight would otherwise see BTC's odds on ETH.
    let live = true;
    setLoading(true);
    setMarket(null);

    async function read() {
      try {
        const rows = await exchange.client.listLiveBinaryMarkets({
          asset,
          intervalSec: APP_CADENCE_SECONDS,
          limit: PAGE_SIZE,
        });
        if (!live) return;
        setMarket(pickTradableMarket(rows.map(toDreamdexMarket), Date.now()));
        setError(false);
      } catch {
        // Keep the last known market rather than blanking the odds mid-window;
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
    quote: quoteFromProbability(market?.lastProbability ?? null),
    loading,
    error,
  };
}
