import type { AssetSymbol } from "@/lib/assets";

export type Direction = "up" | "down";

/**
 * Where the user stands in the current event window.
 * - `open`      nothing staked yet, UP/DOWN are live
 * - `committed` staked, watching it play out
 * - `settled`   window closed, result being shown
 */
export type RoundState = "open" | "committed" | "settled";

export interface Position {
  direction: Direction;
  /** Collateral staked. */
  stake: number;
  /** The event contract this position settles on. */
  marketId: `0x${string}`;
  /**
   * The window's shared strike — the line this position settles against, taken
   * from the contract. Every player in the window has the same one, so UP and
   * DOWN are true opposites.
   */
  strike: number;
  /** Price when the user tapped. Shown for context; it does not decide the bet. */
  entryPrice: number;
  /** Payout multiplier the market was quoting when the user committed. */
  payoutMultiplier: number;
}

export interface HistoryEntry {
  id: string;
  symbol: AssetSymbol;
  direction: Direction;
  stake: number;
  won: boolean;
  /** Net collateral: positive on a win, negative on a loss. */
  net: number;
  /** Pre-formatted relative label — keeps the list free of clock-dependent
      rendering, which would otherwise differ between server and client. */
  when: string;
}

export interface UserStats {
  /** Consecutive correct calls. The retention mechanic. */
  streak: number;
  bestStreak: number;
  /** 0–1. */
  winRate: number;
  rounds: number;
}

/**
 * Whether a position is *currently* on the right side of its strike. This is the
 * live "you're winning" read on a running window — a running commentary, not a
 * verdict. The settled result comes from the contract (see `useSettlement`),
 * never from this.
 */
export function isAhead(position: Position, currentPrice: number): boolean {
  return position.direction === "up"
    ? currentPrice >= position.strike
    : currentPrice < position.strike;
}

/**
 * Net collateral for a settled position: winnings above the stake, or the stake
 * lost. A void returns the stake, so the result is zero either way.
 */
export function netResult(
  position: Position,
  winner: Direction | null
): number {
  if (winner === null) return 0;
  return winner === position.direction
    ? position.stake * (position.payoutMultiplier - 1)
    : -position.stake;
}

/* --- Mock data. Replaced by contract reads + persistence once the loop is wired. --- */

export const MOCK_STATS: UserStats = {
  streak: 4,
  bestStreak: 7,
  winRate: 0.68,
  rounds: 25,
};

export const MOCK_HISTORY: HistoryEntry[] = [
  { id: "r25", symbol: "BTC",  direction: "up",   stake: 50, won: true,  net: 27.0,  when: "15m ago" },
  { id: "r24", symbol: "BTC",  direction: "up",   stake: 25, won: true,  net: 13.5,  when: "30m ago" },
  { id: "r23", symbol: "ETH",  direction: "down", stake: 10, won: true,  net: 13.2,  when: "45m ago" },
  { id: "r22", symbol: "ETH",  direction: "up",   stake: 20, won: true,  net: 10.8,  when: "1h ago"  },
  { id: "r21", symbol: "ETH",  direction: "down", stake: 20, won: false, net: -20.0, when: "1h ago"  },
  { id: "r20", symbol: "BTC",  direction: "up",   stake: 50, won: true,  net: 27.0,  when: "2h ago"  },
  { id: "r19", symbol: "ETH",  direction: "up",   stake: 5,  won: false, net: -5.0,  when: "2h ago"  },
  { id: "r18", symbol: "BTC",  direction: "down", stake: 10, won: true,  net: 12.4,  when: "3h ago"  },
];

/** Stake used for the mocked position until Step 2's input sheet exists. */
export const MOCK_STAKE = 50;
