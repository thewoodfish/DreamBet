"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHistory } from "@/lib/board/client";
import { isTradableAsset } from "@/lib/dreamdex/config";
import { formatRelativeTime } from "@/lib/format";
import { MOCK_HISTORY, type HistoryEntry } from "@/lib/round";
import type { AssetSymbol } from "@/lib/assets";

export interface PlayerHistory {
  entries: HistoryEntry[];
  /** False when these are the sample rounds rather than the player's own. */
  real: boolean;
  loading: boolean;
  refresh: () => void;
}

/**
 * The player's own settled bets, for the list under their record.
 *
 * The tiles above this list went real before it did, which left true figures
 * standing over invented evidence — a 3-round record above five rounds that
 * never happened. Same bets the standings score, sliced to one address.
 *
 * "When" is formatted here rather than on the server on purpose: the server has
 * no business guessing what now is, and a relative time rendered on both sides
 * of hydration disagrees by exactly the length of the request.
 */
export function usePlayerHistory(address: string | null): PlayerHistory {
  const [entries, setEntries] = useState<HistoryEntry[]>(MOCK_HISTORY);
  const [real, setReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setEntries(MOCK_HISTORY);
      setReal(false);
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);

    fetchHistory(address).then((result) => {
      if (!live) return;

      const rows = result.rows
        // An asset this build cannot draw would take the icon lookup down with
        // it. The venue's naming is not this app's to depend on.
        .filter((row) => isTradableAsset(row.symbol))
        .map<HistoryEntry>((row) => ({
          id: row.id,
          symbol: row.symbol as AssetSymbol,
          direction: row.direction,
          stake: row.stake,
          won: row.won,
          voided: row.voided,
          net: row.net,
          when: formatRelativeTime(row.ts),
        }));

      if (result.unavailable || rows.length === 0) {
        // No store, or no settled bets yet. The sample rounds stay, for the
        // same reason they stay on the tiles: an empty list on a demo reads as
        // broken rather than new.
        setEntries(MOCK_HISTORY);
        setReal(false);
      } else {
        setEntries(rows);
        setReal(true);
      }
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, [address, nonce]);

  return { entries, real, loading, refresh };
}
