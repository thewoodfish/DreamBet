"use client";

import { useEffect, useState } from "react";
import { fetchBoard } from "@/lib/board/client";
import type { LeaderboardEntry, LeaderboardScope } from "@/lib/leaderboard";

export interface Board {
  rows: LeaderboardEntry[];
  loading: boolean;
  /** No store is wired up, so there are no real standings to show. */
  unavailable: boolean;
}

/**
 * Standings for a scope, read when the sheet opens rather than polled.
 *
 * Nobody watches a leaderboard tick. It is opened, read, and closed — so this
 * fetches on open and on a scope change, and leaves it at that.
 */
export function useLeaderboard(
  scope: LeaderboardScope,
  chatInstance: string | null,
  me: string | null
): Board {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);

    fetchBoard(scope, chatInstance, me).then((board) => {
      if (!live) return;
      setRows(board.rows);
      setUnavailable(board.unavailable);
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, [scope, chatInstance, me]);

  return { rows, loading, unavailable };
}
