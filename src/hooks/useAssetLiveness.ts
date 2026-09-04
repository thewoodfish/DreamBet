"use client";

import { useEffect, useRef, useState } from "react";
import { exchange } from "@/lib/dreamdex/client";
import { TRADED_CADENCES, TRADABLE_ASSETS } from "@/lib/dreamdex/config";
import {
  livenessAfterPoll,
  pickTradableMarket,
  toDreamdexMarket,
  type AssetLiveness,
} from "@/lib/dreamdex/market";
import type { AssetSymbol } from "@/lib/assets";

/**
 * How often every asset's board is swept.
 *
 * Deliberately slower than the selected asset's own 8s poll: this is one query
 * per asset per traded cadence, so a sweep is a dozen requests against a public
 * indexer, and it is answering a coarser question — whether a pill is worth
 * tapping, not what the window inside it is doing.
 */
const POLL_MS = 20_000;

/** Only ever asked "is anything open"; the first rows answer that. */
const PAGE_SIZE = 3;

export type AssetLivenessMap = Record<AssetSymbol, AssetLiveness>;

const INITIAL: AssetLivenessMap = Object.fromEntries(
  TRADABLE_ASSETS.map((asset) => [asset, "unknown" as AssetLiveness])
) as AssetLivenessMap;

/**
 * Which assets have something to bet on right now.
 *
 * Liveness is per asset, not per app: BTC and ETH only appear to move together
 * because the same creator rolls them together, and SOL is the standing
 * counter-example — its series has been stopped for hours. Without this the
 * pill row would look identical either way, and the only way to find out an
 * asset was dark would be to tap it.
 *
 * The state is never allowed to go backwards on a failed request: a dropped
 * sweep leaves every pill as it was, because "the indexer did not answer" is
 * not the same fact as "the venue has nothing open".
 */
export function useAssetLiveness(): AssetLivenessMap {
  const [liveness, setLiveness] = useState<AssetLivenessMap>(INITIAL);

  // When each asset was last seen with a window open. Survives across sweeps,
  // which is what lets a roll between two windows be bridged rather than shown.
  const lastLiveAt = useRef<Partial<Record<AssetSymbol, number>>>({});

  useEffect(() => {
    let live = true;

    async function sweep() {
      const results = await Promise.all(
        TRADABLE_ASSETS.map(async (asset) => {
          try {
            const boards = await Promise.all(
              TRADED_CADENCES.map((intervalSec) =>
                exchange.client.listLiveBinaryMarkets({
                  asset,
                  intervalSec,
                  limit: PAGE_SIZE,
                })
              )
            );
            const now = Date.now();
            const tradable = boards.some(
              (board) =>
                pickTradableMarket(board.map(toDreamdexMarket), now) !== null
            );
            return { asset, tradable };
          } catch {
            // No answer for this asset this time round. Reported as such, so
            // its pill keeps whatever it was last actually told.
            return { asset, tradable: null };
          }
        })
      );

      if (!live) return;
      const now = Date.now();

      setLiveness((prev) => {
        const next = { ...prev };
        for (const { asset, tradable } of results) {
          if (tradable === null) continue;
          if (tradable) lastLiveAt.current[asset] = now;
          next[asset] = livenessAfterPoll(
            tradable,
            lastLiveAt.current[asset] ?? null,
            now
          );
        }
        return next;
      });
    }

    void sweep();
    const id = setInterval(() => void sweep(), POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return liveness;
}
