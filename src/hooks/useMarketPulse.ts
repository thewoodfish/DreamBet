"use client";

import { useEffect, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { TRADED_CADENCES } from "@/lib/dreamdex/config";
import { fetchBookDepth } from "@/lib/dreamdex/book";
import {
  resolvedDirection,
  toDreamdexMarket,
  type DreamdexMarket,
} from "@/lib/dreamdex/market";
import type { BookDepth, GroupTally, WindowOutcome } from "@/lib/pulse";

/**
 * How often the panel re-reads while it is open.
 *
 * Slower than the window poll behind it, because none of this changes on a
 * one-second timescale: settled windows are settled, the book moves in minutes,
 * and the group's bets arrive when somebody bets. The distance to the line does
 * move, but it is recomputed from the price feed on every tick without any
 * fetch at all.
 */
const POLL_MS = 15_000;

/** Past windows read back for the outcome strip. */
const RECENT = 6;

export interface MarketPulseData {
  recent: WindowOutcome[];
  book: BookDepth | null;
  group: GroupTally | null;
  loading: boolean;
}

const EMPTY: MarketPulseData = {
  recent: [],
  book: null,
  group: null,
  loading: true,
};

/** The venue indexes a cadence as a band, so a 15m series turns up at 899s. */
function cadenceOf(market: DreamdexMarket): number {
  return (
    TRADED_CADENCES.find((c) => Math.abs(market.windowSeconds - c) <= 5) ??
    market.windowSeconds
  );
}

/**
 * The parts of the market pulse that have to be fetched.
 *
 * Everything derivable from what the screen already holds — the distance to the
 * line, how much the asset typically moves, the sentence tying them together —
 * is computed in `readPulse` from the price feed and the window, and costs
 * nothing. This hook only goes and gets the three things nobody has yet: how
 * previous windows closed, what is resting in the book, and who from the group
 * is already in.
 *
 * Only runs while the panel is open. A closed drawer polling an indexer is
 * three requests every fifteen seconds for something nobody is looking at.
 */
export function useMarketPulse(
  market: DreamdexMarket | null,
  chatInstance: string | null,
  open: boolean
): MarketPulseData {
  const [data, setData] = useState<MarketPulseData>(EMPTY);

  useEffect(() => {
    if (!open || !market) {
      setData(EMPTY);
      return;
    }

    let live = true;
    const cadence = cadenceOf(market);

    async function read() {
      if (!market) return;

      const [recent, book, group] = await Promise.all([
        fetchRecentOutcomes(market.asset, cadence),
        fetchBookDepth(market.poolAddress, market.decimals),
        fetchGroupTally(market.marketId, chatInstance),
      ]);

      if (!live) return;
      setData({ recent, book, group, loading: false });
    }

    void read();
    const id = setInterval(() => void read(), POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
    // `market` is re-fetched whenever the window rolls, and a new window means
    // a new book and a new set of bets, so keying on its id is what makes the
    // panel follow the round rather than the object identity of the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, market?.marketId, market?.poolAddress, chatInstance]);

  return data;
}

/**
 * How the last few windows on this cadence actually closed.
 *
 * Read off the contracts rather than inferred from the price series: a window
 * settles against its own opening print, so comparing two chart points is a
 * guess at the verdict, while `winningOutcome` is the verdict.
 */
async function fetchRecentOutcomes(
  asset: string,
  intervalSec: number
): Promise<WindowOutcome[]> {
  try {
    const rows = await exchange.client.listPastBinaryMarkets({
      asset,
      intervalSec,
      limit: RECENT * 2,
    });

    const outcomes: WindowOutcome[] = [];
    for (const row of rows) {
      const market = toDreamdexMarket(row);
      if (market.voided) {
        outcomes.push("void");
      } else {
        const winner = resolvedDirection(market);
        // A market that has expired but not yet settled has no verdict to
        // report. Skipped rather than guessed at, so the strip only ever shows
        // windows that genuinely finished.
        if (winner === null) continue;
        outcomes.push(winner);
      }
      if (outcomes.length === RECENT) break;
    }
    return outcomes;
  } catch {
    return [];
  }
}

/** The group's bets on this exact window, as a tally and never as names. */
async function fetchGroupTally(
  marketId: string,
  chatInstance: string | null
): Promise<GroupTally | null> {
  const query = new URLSearchParams({ market: marketId });
  if (chatInstance) query.set("group", chatInstance);

  try {
    const response = await fetch(`/api/board/window?${query}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as GroupTally & {
      unavailable?: boolean;
    };
    return body.unavailable ? null : body;
  } catch {
    return null;
  }
}
