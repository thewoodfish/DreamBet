import { exchange } from "@/lib/dreamdex/client";
import { resolvedDirection, toDreamdexMarket } from "@/lib/dreamdex/market";
import { readJson, writeJson } from "@/lib/server/store";
import type { Verdict } from "@/lib/board/types";

/**
 * What a settled window turned out to be, cached once it can no longer change.
 *
 * The verdict was already cached; the asset is here because a bet record only
 * carries the market it went into, and a history list has to say which pair it
 * was on. Both come off the same market read, so caching them together costs
 * nothing and halves the reads the standings and the history do between them.
 */
export interface MarketFacts {
  verdict: Verdict;
  /** "BTC", "ETH" — as the venue names it. */
  asset: string;
}

/**
 * Deliberately a new key rather than a new shape under the old one: `verdict:`
 * entries are bare strings written by earlier deploys, and reading those as
 * objects would quietly score every one of them as unsettled.
 */
const factsKey = (marketId: string) => `facts:${marketId.toLowerCase()}`;

/**
 * The outcome of each market, for the ones that have one.
 *
 * A market still running is simply absent — its bets sit out of the scoring
 * rather than counting as losses, which is the difference between a leaderboard
 * and a slander. A finalised market never changes its mind, so its answer is
 * written down permanently.
 */
export async function settledFactsFor(
  marketIds: string[]
): Promise<Map<string, MarketFacts>> {
  const facts = new Map<string, MarketFacts>();

  await Promise.all(
    marketIds.map(async (id) => {
      const cached = await readJson<MarketFacts>(factsKey(id));
      if (cached) {
        facts.set(id, cached);
        return;
      }

      try {
        const raw = await exchange.client.getMarket(id);
        if (!raw || raw.marketType !== "BINARY") return;

        const market = toDreamdexMarket(raw);
        const winner = resolvedDirection(market);
        if (winner === null && !market.voided) return;

        const entry: MarketFacts = {
          verdict: market.voided ? "void" : (winner as Verdict),
          asset: market.asset,
        };
        facts.set(id, entry);
        await writeJson(factsKey(id), entry);
      } catch {
        // Unreadable market: its bets stay unscored rather than counted wrong.
      }
    })
  );

  return facts;
}
