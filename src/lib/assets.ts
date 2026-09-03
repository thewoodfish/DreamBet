export type AssetSymbol = "BTC" | "ETH" | "SOMI";

export interface Asset {
  symbol: AssetSymbol;
  /** Display pair, e.g. "BTC/USDso". */
  pair: string;
  name: string;
  /** Seed price for the mock feed, replaced by the real oracle in Step 4. */
  basePrice: number;
  /** Per-tick volatility as a fraction of price. Drives the random walk. */
  volatility: number;
  /** Decimal places used when rendering the price. */
  decimals: number;
}

export const ASSETS: Asset[] = [
  {
    symbol: "BTC",
    pair: "BTC/USDso",
    name: "Bitcoin",
    basePrice: 68_420.5,
    volatility: 0.0009,
    decimals: 2,
  },
  {
    symbol: "ETH",
    pair: "ETH/USDso",
    name: "Ethereum",
    basePrice: 3_512.88,
    volatility: 0.0013,
    decimals: 2,
  },
  {
    symbol: "SOMI",
    pair: "SOMI/USDso",
    name: "Somnia",
    basePrice: 1.284,
    volatility: 0.0031,
    decimals: 4,
  },
];

export const DEFAULT_ASSET = ASSETS[0].symbol;

export function getAsset(symbol: AssetSymbol): Asset {
  const asset = ASSETS.find((a) => a.symbol === symbol);
  if (!asset) throw new Error(`Unknown asset: ${symbol}`);
  return asset;
}

/**
 * Small deterministic PRNG. The mock feed has to produce the *same* opening
 * history on the server and on the client, or React hydration blows up — so
 * every seeded value is derived from the symbol rather than Math.random().
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromSymbol(symbol: string): number {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    hash ^= symbol.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Number of points held in the rolling 1-hour trend line. */
export const HISTORY_LENGTH = 60;

/**
 * Deterministic opening history for an asset: a gentle random walk ending at
 * (roughly) the asset's base price, so the chart is populated on first paint.
 */
export function seedHistory(asset: Asset): number[] {
  const rand = mulberry32(seedFromSymbol(asset.symbol));
  const points: number[] = [];
  let price = asset.basePrice * (1 - asset.volatility * 12);

  for (let i = 0; i < HISTORY_LENGTH; i += 1) {
    // Slight upward drift so the seeded window reads as a real trend, not noise.
    const drift = asset.volatility * 0.35;
    const shock = (rand() - 0.5) * asset.volatility * 4;
    price = price * (1 + drift + shock);
    points.push(price);
  }
  return points;
}

/** Advance the walk by one tick from the most recent price. */
export function nextPrice(asset: Asset, last: number): number {
  const shock = (Math.random() - 0.5) * asset.volatility * 4;
  // Weak mean reversion keeps the mock feed from wandering off over a long session.
  const pull = (asset.basePrice - last) / asset.basePrice * 0.02;
  return Math.max(last * (1 + shock + pull), asset.basePrice * 0.5);
}

/**
 * The line every player in the window is betting against, frozen when the
 * window opens. Deriving it from (symbol, window) means every client in a
 * Telegram group computes the same strike with no shared state — and, unlike a
 * per-user entry price, it makes UP and DOWN genuinely opposite outcomes, which
 * is what the parimutuel odds in `poolSnapshot` assume.
 *
 * Step 4 replaces this with the strike the event contract actually published.
 */
export function strikeFor(asset: Asset, windowIndex: number): number {
  const rand = mulberry32(seedFromSymbol(`${asset.symbol}-strike-${windowIndex}`));
  // Sit within a plausible tick of the base price so the live feed straddles it.
  const offset = (rand() - 0.5) * asset.volatility * 6;
  const raw = asset.basePrice * (1 + offset);
  const factor = 10 ** asset.decimals;
  return Math.round(raw * factor) / factor;
}

export interface PoolSnapshot {
  /** Share of the pool sitting on UP, 0–1. */
  upShare: number;
  /** Parimutuel multiplier on a winning UP position, e.g. 1.85×. */
  payoutUp: number;
  payoutDown: number;
  /** Total USDso staked across both sides. */
  totalStaked: number;
}

/** House cut taken out of the losing side before it's redistributed. */
const RAKE = 0.03;

/**
 * Deterministic stand-in for the live dreamDEX pool. Parimutuel odds: the
 * lighter side pays more, so the numbers move together the way they will once
 * Step 4 reads real contract state.
 */
export function poolSnapshot(symbol: AssetSymbol): PoolSnapshot {
  const rand = mulberry32(seedFromSymbol(`${symbol}-pool`));
  const upShare = 0.35 + rand() * 0.3;
  const totalStaked = Math.round((8_000 + rand() * 24_000) / 10) * 10;

  return {
    upShare,
    payoutUp: (1 / upShare) * (1 - RAKE),
    payoutDown: (1 / (1 - upShare)) * (1 - RAKE),
    totalStaked,
  };
}
