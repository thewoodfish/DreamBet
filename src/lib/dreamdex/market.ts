import { binaryResolutionMode } from "@somnia-chain/markets-sdk";
import type { BinaryMarket, BinaryMarketStatus } from "@somnia-chain/markets-sdk";
import { STRIKE_SCALE } from "./config";

/** How a market decides UP: against a fixed strike, or against its own open. */
export type ResolutionMode = "fixed" | "reference";

/** A live event window, normalised for the UI. */
export interface DreamdexMarket {
  marketId: `0x${string}`;
  /** BinaryPool — the address orders are placed against. */
  poolAddress: `0x${string}`;
  marketAddress: `0x${string}`;
  asset: string;
  /**
   * The line UP is measured against, already descaled. Null in reference mode,
   * where there is no fixed threshold to show — the window resolves by
   * comparing its opening and closing oracle answers.
   */
  strike: number | null;
  mode: ResolutionMode;
  /** Unix seconds. */
  tradingStart: number;
  expiry: number;
  /** Window length in seconds — one rung of the venue's cadence ladder. */
  windowSeconds: number;
  status: BinaryMarketStatus;
  yesTokenId: bigint;
  noTokenId: bigint;
  collateral: `0x${string}`;
  /** Collateral decimals, which prices and quantities are scaled by. */
  decimals: number;
  /** Last traded UP probability in (0,1), or null if the book has never traded. */
  lastProbability: number | null;
  winningOutcome: number | null;
  voided: boolean;
  /** Collateral traded over the market's life, descaled. */
  volume: number;
  tradeCount: number;
}

/**
 * Statuses that mean the book is shut for good, or shut pending settlement.
 * `Listed` is deliberately absent: the Listed → Trading transition is implicit
 * in the timestamps and emits no event, so a market whose `tradingStart` has
 * passed is live regardless of the status it was last stamped with. Reading
 * `status === "Trading"` alone would hide perfectly tradeable windows.
 */
const HALTED: ReadonlySet<BinaryMarketStatus> = new Set<BinaryMarketStatus>([
  "Locked",
  "Settling",
  "Resolved",
  "Voided",
  "Finalized",
]);

/** True while the window is inside its trading period and not halted. */
export function isTrading(market: DreamdexMarket, nowMs: number): boolean {
  const now = Math.floor(nowMs / 1000);
  return (
    !HALTED.has(market.status) &&
    now >= market.tradingStart &&
    now < market.expiry
  );
}

function num(v: string | number | bigint | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

/**
 * Normalise an indexer row into the shape the UI wants. The raw row mixes
 * decimal strings, unix seconds and a 100-scaled strike; nothing downstream
 * should have to know that.
 */
export function toDreamdexMarket(m: BinaryMarket): DreamdexMarket {
  const mode = binaryResolutionMode(m.strike) as ResolutionMode;
  const decimals = m.quoteDecimals ?? 6;
  const tradingStart = num(m.tradingStart);
  const expiry = num(m.expiry);

  return {
    marketId: m.marketId as `0x${string}`,
    poolAddress: m.poolAddress as `0x${string}`,
    marketAddress: m.marketAddress as `0x${string}`,
    asset: m.asset,
    strike: mode === "fixed" ? num(m.strike) / STRIKE_SCALE : null,
    mode,
    tradingStart,
    expiry,
    windowSeconds: Math.max(expiry - tradingStart, 0),
    status: m.status,
    yesTokenId: BigInt(m.yesTokenId ?? 0),
    noTokenId: BigInt(m.noTokenId ?? 0),
    collateral: m.collateral as `0x${string}`,
    decimals,
    lastProbability:
      m.lastPrice === null || m.lastPrice === undefined
        ? null
        : Number(m.lastPrice) / 10 ** decimals,
    winningOutcome: m.winningOutcome ?? null,
    voided: Boolean(m.voided),
    volume: num(m.cumulativeQuoteVolume) / 10 ** decimals,
    tradeCount: num(m.tradeCount),
  };
}

/** What a punter is offered on each side of a window. */
export interface MarketQuote {
  /** Implied probability UP resolves true, in (0,1). */
  upProbability: number;
  /** Payout per 1 collateral staked. Buying UP at 0.54 returns 1/0.54 = 1.85×. */
  payoutUp: number;
  payoutDown: number;
  /** True when this is a placeholder because the book has never traded. */
  isIndicative: boolean;
}

/**
 * The odds a binary market offers fall straight out of its price, because an
 * outcome token pays exactly 1 collateral if it wins: price *is* the implied
 * probability, and the multiplier is its reciprocal.
 *
 * This replaces the parimutuel model the mock used, which divided a pool by the
 * share sitting on each side. That was the wrong shape for a CLOB — it implied
 * the odds move only when someone bets, when in fact they move whenever the
 * book is repriced, and it needed a house rake that this venue does not take.
 */
export function quoteFromProbability(
  upProbability: number | null
): MarketQuote {
  // An untraded book has no price to read. 0.5 is the honest placeholder — it
  // is what "no information" means here — but it must be labelled as such
  // rather than shown as if it were a real quote.
  const isIndicative = upProbability === null;
  const p = clampProbability(upProbability ?? 0.5);

  return {
    upProbability: p,
    payoutUp: 1 / p,
    payoutDown: 1 / (1 - p),
    isIndicative,
  };
}

/**
 * Keep the probability off the ends. At exactly 0 or 1 the reciprocal is
 * infinite, and a book quoting a certainty is one there is no point betting
 * into; clamping keeps the payout finite and the UI honest.
 */
export function clampProbability(p: number): number {
  const EPS = 0.001;
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(Math.max(p, EPS), 1 - EPS);
}

/** Seconds left before the window stops accepting orders. */
export function secondsUntilExpiry(market: DreamdexMarket, nowMs: number): number {
  return Math.max(market.expiry - Math.floor(nowMs / 1000), 0);
}

/**
 * Choose the window to trade out of what the indexer returned. The list comes
 * back soonest-to-expire first, which is the order a punter wants: the nearest
 * window that is genuinely open.
 *
 * A window in its last seconds is skipped rather than offered — it is about to
 * lock, and a tap that lands after expiry is a bet the user never got to make.
 */
export function pickTradableMarket(
  markets: DreamdexMarket[],
  nowMs: number,
  minSecondsLeft = 5
): DreamdexMarket | null {
  return (
    markets.find(
      (m) =>
        isTrading(m, nowMs) && secondsUntilExpiry(m, nowMs) >= minSecondsLeft
    ) ?? null
  );
}
