import { binaryResolutionMode, boundaryPrice } from "@somnia-chain/markets-sdk";
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

/** How an asset reads in the pill row. */
export type AssetLiveness = "unknown" | "live" | "paused";

/**
 * How long an asset that has gone empty keeps reading as live.
 *
 * Windows change over in seconds — on the 1-minute series, constantly — and a
 * pill that blinked out at every roll would be unusable. This bridges the gap,
 * and matches the stall the countdown applies to the selected asset so the two
 * never contradict each other.
 */
export const LIVENESS_STALL_MS = 90_000;

/**
 * What one poll of an asset's board means for its pill.
 *
 * The asymmetry is the point: anything open makes an asset live at once, while
 * an empty board only makes it paused after the bridge has elapsed — *unless*
 * nothing has ever been seen open, in which case there is no roll to bridge and
 * no reason to imply otherwise. That last case is what stops a genuinely dark
 * asset from spending its first minute and a half looking tradeable.
 */
export function livenessAfterPoll(
  tradable: boolean,
  /** When this asset was last seen with a window open, in ms, or null if never. */
  lastLiveAt: number | null,
  nowMs: number,
  stallMs: number = LIVENESS_STALL_MS
): Exclude<AssetLiveness, "unknown"> {
  if (tradable) return "live";
  if (lastLiveAt === null) return "paused";
  return nowMs - lastLiveAt < stallMs ? "live" : "paused";
}

/**
 * The line the window settles against, whichever way this market establishes
 * one. A fixed-strike market carries it directly; a reference market ("closes
 * at or above its opening price") reaches it through the oracle answer its
 * reference question was given, which is why the opening prices have to be
 * fetched alongside the market itself.
 *
 * Null while a reference market's opening print has not been posted yet — a
 * real state in the first moments of a window, and not one to paper over with
 * a zero.
 */
export function marketBoundary(
  market: BinaryMarket,
  openingPrices: Record<string, string | null>
): number | null {
  const boundary = boundaryPrice(market, openingPrices);
  if (!boundary || !boundary.posted) return null;

  const value = Number(boundary.raw) / STRIKE_SCALE;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Which side the contract actually paid out, once it has resolved. The indexer
 * derives this from a one-hot payout vector, so a void or partial resolution
 * leaves it null rather than picking a winner — treat that as "no verdict",
 * never as a loss.
 */
export function resolvedDirection(
  market: Pick<DreamdexMarket, "winningOutcome" | "voided">
): "up" | "down" | null {
  if (market.voided || market.winningOutcome === null) return null;
  // Outcome 0 is YES — "closes at or above" — which is the UP side.
  return market.winningOutcome === 0 ? "up" : "down";
}
