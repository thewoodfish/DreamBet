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
  /** USDso staked. */
  stake: number;
  /** Price at the moment of commit — drawn on the chart as the entry line. */
  entryPrice: number;
  /** Parimutuel multiplier locked in at commit time. */
  payoutMultiplier: number;
}

export interface HistoryEntry {
  id: string;
  symbol: AssetSymbol;
  direction: Direction;
  stake: number;
  won: boolean;
  /** Net USDso: positive on a win, negative on a loss. */
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

/** True when a position finished on the right side of the move. */
export function didWin(position: Position, settlePrice: number): boolean {
  return position.direction === "up"
    ? settlePrice > position.entryPrice
    : settlePrice < position.entryPrice;
}

/** Net USDso for a settled position: winnings above the stake, or the stake lost. */
export function netResult(position: Position, settlePrice: number): number {
  return didWin(position, settlePrice)
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
  { id: "r23", symbol: "SOMI", direction: "down", stake: 10, won: true,  net: 13.2,  when: "45m ago" },
  { id: "r22", symbol: "ETH",  direction: "up",   stake: 20, won: true,  net: 10.8,  when: "1h ago"  },
  { id: "r21", symbol: "ETH",  direction: "down", stake: 20, won: false, net: -20.0, when: "1h ago"  },
  { id: "r20", symbol: "BTC",  direction: "up",   stake: 50, won: true,  net: 27.0,  when: "2h ago"  },
  { id: "r19", symbol: "SOMI", direction: "up",   stake: 5,  won: false, net: -5.0,  when: "2h ago"  },
  { id: "r18", symbol: "BTC",  direction: "down", stake: 10, won: true,  net: 12.4,  when: "3h ago"  },
];

/** Stake used for the mocked position until Step 2's input sheet exists. */
export const MOCK_STAKE = 50;
