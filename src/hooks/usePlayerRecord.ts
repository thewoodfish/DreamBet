"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBoard } from "@/lib/board/client";
import { MOCK_STATS, type UserStats } from "@/lib/round";

export interface PlayerRecord {
  /** The player's real figures, or the sample ones while there are none. */
  stats: UserStats;
  /** False when `stats` is the sample set rather than this player's own. */
  real: boolean;
  loading: boolean;
  /** Re-read after a round settles, so the streak on screen is the new one. */
  refresh: () => void;
}

/**
 * The player's own record, read from the standings the server already keeps.
 *
 * The streak was the last mock number left on the main screen, and it was the
 * one that mattered most: it is the reason to come back, so a made-up 4 was the
 * app claiming a history the player had not lived. Everything here is derived
 * from bets the chain confirmed and windows the contract settled.
 *
 * The sample figures stay as the fallback rather than zeros. With no standings
 * store wired up there is no record to show, and an app insisting a real player
 * has never won anything is a worse lie than an obvious placeholder — `real`
 * says which of the two is on screen.
 */
export function usePlayerRecord(address: string | null): PlayerRecord {
  const [stats, setStats] = useState<UserStats>(MOCK_STATS);
  const [real, setReal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setStats(MOCK_STATS);
      setReal(false);
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);

    // Global rather than the group's board: a record is the player's whole
    // history, not what one chat has seen of it.
    fetchBoard("global", null, address).then((board) => {
      if (!live) return;

      const mine = board.rows.find((row) => row.isYou);
      if (board.unavailable || !mine) {
        // No store, or no settled bets yet. Either way there is no record to
        // report, and inventing an empty one would read as a losing streak.
        setStats(MOCK_STATS);
        setReal(false);
      } else {
        setStats({
          streak: mine.streak,
          bestStreak: mine.bestStreak ?? mine.streak,
          winRate: mine.winRate,
          rounds: mine.rounds ?? 0,
        });
        setReal(true);
      }
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, [address, nonce]);

  return { stats, real, loading, refresh };
}
