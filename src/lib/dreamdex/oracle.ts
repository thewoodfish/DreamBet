import { exchange } from "./client";
import { STRIKE_SCALE, PRICE_SERIES_CADENCE_SECONDS } from "./config";

/** One oracle print: a price the feed actually published, at a known time. */
export interface PricePoint {
  /** Unix seconds. */
  t: number;
  price: number;
}

/**
 * The venue publishes no standalone price feed, but it does not need to: every
 * market on the 1-minute series is created with a *fixed* strike, and that
 * strike is the feed's spot at the block the market was created in. Reading a
 * run of them back is therefore reading the oracle's own 1-minute history —
 * real prints, not a simulation, and on exactly the scale the 15-minute
 * windows settle against.
 *
 * Reference-mode rows carry strike 0 as a sentinel rather than a price, so they
 * are dropped rather than plotted as a crash to zero.
 */
function toSeries(
  rows: { tradingStart: string | number; strike: string }[]
): PricePoint[] {
  const byTime = new Map<number, number>();

  for (const row of rows) {
    const price = Number(row.strike) / STRIKE_SCALE;
    if (price > 0) byTime.set(Number(row.tradingStart), price);
  }

  return Array.from(byTime, ([t, price]) => ({ t, price })).sort(
    (a, b) => a.t - b.t
  );
}

/**
 * The last `points` minutes of prints for an asset, oldest first. Past and live
 * are fetched together because the newest print belongs to the market that is
 * still open — leaving it out would make the chart lag a minute behind.
 */
export async function fetchPriceHistory(
  asset: string,
  points: number
): Promise<PricePoint[]> {
  const [past, live] = await Promise.all([
    exchange.client.listPastBinaryMarkets({
      asset,
      intervalSec: PRICE_SERIES_CADENCE_SECONDS,
      limit: points,
    }),
    exchange.client.listLiveBinaryMarkets({
      asset,
      intervalSec: PRICE_SERIES_CADENCE_SECONDS,
      limit: 3,
    }),
  ]);

  return toSeries([...past, ...live]).slice(-points);
}

/**
 * Just the newest prints, for topping the series up between full reads. A new
 * one lands every minute, so a handful is plenty of overlap to never miss one.
 */
export async function fetchLatestPrices(asset: string): Promise<PricePoint[]> {
  const [past, live] = await Promise.all([
    exchange.client.listPastBinaryMarkets({
      asset,
      intervalSec: PRICE_SERIES_CADENCE_SECONDS,
      limit: 3,
    }),
    exchange.client.listLiveBinaryMarkets({
      asset,
      intervalSec: PRICE_SERIES_CADENCE_SECONDS,
      limit: 3,
    }),
  ]);

  return toSeries([...past, ...live]);
}
