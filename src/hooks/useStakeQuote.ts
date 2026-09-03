"use client";

import { useEffect, useState } from "react";
import { quoteStake, type StakeQuote } from "@/lib/dreamdex/book";
import type { Direction } from "@/lib/round";

/**
 * How long the amount has to sit still before the book is walked for it. A
 * punter typing "50" passes through 5 and then 50, and quoting the 5 costs a
 * round trip whose answer is thrown away before it lands.
 */
const DEBOUNCE_MS = 220;

/**
 * The book moves whether or not the user is typing, so an open ticket re-quotes
 * on its own. Slower than the board poll: this is a sanity refresh on a number
 * the user is looking at, not a live feed.
 */
const REFRESH_MS = 10_000;

export interface StakeQuoteState {
  /** What the stake buys, or null while it is unknown. */
  quote: StakeQuote | null;
  /** A quote is in flight — keep showing the last one rather than blanking it. */
  loading: boolean;
  /** The book cannot fill this stake at all: nothing resting, or too small a bet. */
  unfillable: boolean;
  /** The book could not be read. Distinct from "there is no bet here". */
  error: boolean;
}

/**
 * Price the open ticket against the live book.
 *
 * This is what the amount input is worth in shares, and it is deliberately not
 * derived from the window's headline odds: those come off the last trade, while
 * this walks the asks a bet of *this size* would actually eat. A large stake in
 * a thin book gets a worse multiplier than the button advertised, and the
 * ticket has to say so before the user taps confirm, not after.
 */
export function useStakeQuote(
  pool: `0x${string}` | null,
  direction: Direction | null,
  stake: number,
  decimals: number
): StakeQuoteState {
  const [quote, setQuote] = useState<StakeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [unfillable, setUnfillable] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pool || !direction || !(stake > 0)) {
      setQuote(null);
      setLoading(false);
      setUnfillable(false);
      setError(false);
      return;
    }

    // A quote for an amount the user has already moved past must not overwrite
    // the one they are looking at.
    let live = true;
    setLoading(true);

    async function read() {
      try {
        const next = await quoteStake(pool!, direction!, stake, decimals);
        if (!live) return;
        setQuote(next);
        setUnfillable(next === null);
        setError(false);
      } catch {
        // A dropped read is not an empty book — say so, and keep whatever was
        // already quoted rather than telling the user their bet is impossible.
        if (live) setError(true);
      } finally {
        if (live) setLoading(false);
      }
    }

    const debounce = setTimeout(read, DEBOUNCE_MS);
    const refresh = setInterval(read, REFRESH_MS);
    return () => {
      live = false;
      clearTimeout(debounce);
      clearInterval(refresh);
    };
  }, [pool, direction, stake, decimals]);

  return { quote, loading, unfillable, error };
}
