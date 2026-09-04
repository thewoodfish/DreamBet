"use client";

import { useEffect, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { TRADED_CADENCES } from "@/lib/dreamdex/config";
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

/**
 * How long with nothing open before this stops reading as a roll between two
 * windows and starts reading as a venue that has stopped rolling them.
 *
 * Windows change over in seconds, so a minute and a half of nothing is not a
 * gap. dreamDEX's testnet deployment does go quiet for stretches — it has sat
 * idle for half an hour at a time — and telling somebody the next window opens
 * "shortly" through all of that is a promise the app cannot keep.
 */
const STALL_MS = 90_000;

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
  /**
   * Nothing has been open long enough that the venue, not the clock, is the
   * reason. Distinct from `market === null`, which is normal for seconds at a
   * time as one window closes and the next opens.
   */
  stalled: boolean;
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
  const [stalled, setStalled] = useState(false);
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
        // Every cadence is asked at once and the answers ranked by preference
        // afterwards, rather than walking the list until one hits. Asking in
        // order would make the common case — the preferred window is open —
        // the fast one and the empty case four sequential round trips, which
        // is exactly backwards: the empty case is the one a player is sitting
        // and staring at.
        const boards = await Promise.all(
          TRADED_CADENCES.map((intervalSec) =>
            exchange.client
              .listLiveBinaryMarkets({ asset, intervalSec, limit: PAGE_SIZE })
              .catch(() => [])
          )
        );
        if (!live) return;

        const now = Date.now();
        let rows: (typeof boards)[number] = [];
        let picked = null;

        for (const board of boards) {
          const candidate = pickTradableMarket(board.map(toDreamdexMarket), now);
          if (candidate) {
            rows = board;
            picked = candidate;
            break;
          }
        }

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

  // A window that is open clears the stall immediately; an empty board has to
  // stay empty for a while before it counts as one. Polling sets the same null
  // over and over, which React treats as no change, so this timer survives
  // across polls and only restarts when something actually opens.
  useEffect(() => {
    if (market) {
      setStalled(false);
      return;
    }

    const id = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(id);
  }, [market, asset]);

  return {
    market,
    boundary,
    quote: quoteFromProbability(market?.lastProbability ?? null),
    loading,
    stalled,
    error,
  };
}
