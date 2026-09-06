import type { Direction } from "@/lib/round";

/**
 * One bet, as recorded for the standings.
 *
 * Everything here except `handle` is checked before it is written: the stake
 * and the side come off a transaction receipt the chain confirmed, and the
 * outcome is never stored at all — it is read back off the market when the
 * standings are built. A player can lie about their Telegram handle and
 * nothing else, which is the right amount of trust for a leaderboard.
 */
export interface BetRecord {
  address: string;
  /** Telegram handle at the time of the bet, when there was one. */
  handle: string | null;
  marketId: string;
  /**
   * The pair this went into. Recoverable from the market, but records written
   * before this field existed have to fall back to that read — so it is
   * optional, and the history route resolves it either way.
   */
  symbol?: string;
  side: Direction;
  /** Collateral actually spent. */
  stake: number;
  /** Outcome tokens actually bought — the gross return if this side wins. */
  shares: number;
  hash: string;
  ts: number;
}

/** What the market did, once it has done it. */
export type Verdict = "up" | "down" | "void";
