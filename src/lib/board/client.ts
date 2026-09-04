"use client";

import { rawInitData } from "@/lib/telegram";
import type { LeaderboardEntry, LeaderboardScope } from "@/lib/leaderboard";
import type { Direction } from "@/lib/round";

export interface RecordBetInput {
  address: string;
  handle: string | null;
  marketId: string;
  side: Direction;
  stake: number;
  shares: number;
  hash: string;
  /** The Telegram chat this was played from — the whole basis of "this group". */
  chatInstance: string | null;
}

/**
 * File a confirmed bet with the standings.
 *
 * Never throws and is never awaited by anything the player is waiting on. The
 * bet is already on-chain by the time this runs; if the leaderboard misses it,
 * the player has still placed it, and the app must not imply otherwise.
 */
export async function recordBet(bet: RecordBetInput): Promise<void> {
  try {
    await fetch("/api/board", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...bet, initData: rawInitData() }),
    });
  } catch {
    // Standings are decoration on top of a bet that already happened.
  }
}

export interface BoardResult {
  rows: LeaderboardEntry[];
  /** No store wired up, so these standings are not real and say so. */
  unavailable: boolean;
}

/** The standings for one scope, newest bets first, already ranked. */
export async function fetchBoard(
  scope: LeaderboardScope,
  chatInstance: string | null,
  me: string | null
): Promise<BoardResult> {
  const query = new URLSearchParams({ scope });
  if (chatInstance) query.set("group", chatInstance);
  if (me) query.set("me", me);

  try {
    const response = await fetch(`/api/board?${query}`, { cache: "no-store" });
    if (!response.ok) return { rows: [], unavailable: true };
    return (await response.json()) as BoardResult;
  } catch {
    return { rows: [], unavailable: true };
  }
}
