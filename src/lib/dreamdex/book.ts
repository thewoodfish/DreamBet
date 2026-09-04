import { quoteBinaryStakeOverBook } from "@somnia-chain/markets-sdk";
import type { BinaryBuySide } from "@somnia-chain/markets-sdk";
import { parseUnits } from "viem";
import { exchange } from "./client";
import type { Direction } from "@/lib/round";

/**
 * Levels of the book to sweep. A stake this size never walks more than a few,
 * and every extra level is depth the pool has to serialise into the same call.
 */
const BOOK_DEPTH = 10;

/**
 * Which outcome token a direction buys. Outcome 0 is YES — "closes at or above"
 * — which is the UP side; the settlement path reads the same mapping the other
 * way round (see `resolvedDirection`).
 */
export function buySideFor(direction: Direction): BinaryBuySide {
  return direction === "up" ? "BUY_YES" : "BUY_NO";
}

/** What a stake actually buys, once the resting book has been walked. */
export interface StakeQuote {
  side: BinaryBuySide;
  /**
   * Collateral the order escrows. This is the real cost and the most that can
   * be lost, and it is never above the stake — a quantity that would not fit is
   * snapped down rather than overspending.
   */
  cost: number;
  /**
   * Outcome tokens bought. Each pays exactly 1 collateral if this side wins, so
   * this is the gross return, not a profit.
   */
  shares: number;
  /** `shares / cost` — the multiplier this specific order is quoted at. */
  payoutMultiplier: number;
  /** Stake the book could not absorb, left unspent rather than chasing a worse price. */
  unfilled: number;
  /** Worst price the order will cross at, in the bought outcome's own terms. */
  limitPrice: number;
  /** Straight into `placeOrder` — raw units on the pool's own tick/lot grid. */
  order: { yesPrice: bigint; quantity: bigint };
}

/**
 * Size a stake against the live book, rather than against the last traded
 * price. The two are not the same number: `lastProbability` is what somebody
 * else paid at some point in the past, while this walks the asks that are
 * actually resting right now, cheapest first, and stops when the next level no
 * longer fits inside the stake.
 *
 * So the multiplier the ticket shows is the one this order can really get,
 * including the slippage of eating more than one level — not the top-of-book
 * fantasy a punter would be quoted and then miss.
 *
 * Null when nothing is fillable: an empty book, or a stake too small to buy one
 * lot. Both are ordinary states on a venue whose short windows often never
 * trade, and both mean there is no bet to offer — not an error to swallow.
 */
export async function quoteStake(
  pool: `0x${string}`,
  direction: Direction,
  stake: number,
  decimals: number
): Promise<StakeQuote | null> {
  const raw = toRaw(stake, decimals);
  if (raw <= 0n) return null;

  const one = 10n ** BigInt(decimals);
  const side = buySideFor(direction);

  // The grid is cached per pool for the client's lifetime, so this is one round
  // trip in practice however often the user retypes the amount.
  const [book, grid] = await Promise.all([
    exchange.client.getBinaryOrderBook(pool, { depth: BOOK_DEPTH, decimals }),
    exchange.client.getBinaryBookParams(pool),
  ]);

  const quote = quoteBinaryStakeOverBook(book, side, raw, one, {
    tickSize: grid.tickSize,
    lotSize: grid.lotSize,
    minQuantity: grid.minQuantity,
  });
  if (!quote || quote.quantity <= 0n || quote.escrow <= 0n) return null;

  const cost = descale(quote.escrow, decimals);
  const shares = descale(quote.quantity, decimals);

  return {
    side: quote.side,
    cost,
    shares,
    payoutMultiplier: shares / cost,
    unfilled: Math.max(stake - cost, 0),
    limitPrice: descale(quote.limitPrice, decimals),
    order: { yesPrice: quote.yesPrice, quantity: quote.quantity },
  };
}

/**
 * What is resting in the book right now, in the terms the pulse panel shows.
 *
 * The asks are the side that matters to a punter: those are the orders somebody
 * buying UP or DOWN would actually cross. Bids are what you could sell into,
 * which is a different question and not the one being asked here.
 *
 * Null on any failure — an unreadable book is a missing row in a panel, never
 * a reason for the panel not to open.
 */
export async function fetchBookDepth(
  pool: `0x${string}`,
  decimals: number
): Promise<{
  upOffers: number;
  downOffers: number;
  upSize: number;
  downSize: number;
} | null> {
  try {
    const book = await exchange.client.getBinaryOrderBook(pool, {
      depth: BOOK_DEPTH,
      decimals,
    });

    const size = (levels: { quantity: bigint }[]) =>
      levels.reduce((total, l) => total + descale(l.quantity, decimals), 0);

    return {
      upOffers: book.yesAsks.length,
      downOffers: book.noAsks.length,
      upSize: size(book.yesAsks),
      downSize: size(book.noAsks),
    };
  } catch {
    return null;
  }
}

/**
 * A human amount into the pool's raw units. Anything finer than the collateral
 * can express is dropped rather than rounded up, so a typed amount can never
 * escrow more than the user asked for.
 */
export function toRaw(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const floored = Math.floor(amount * 10 ** decimals) / 10 ** decimals;
  return parseUnits(floored.toFixed(decimals), decimals);
}

/** Raw units back to whole collateral, for display and for the payout maths. */
export function descale(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}
