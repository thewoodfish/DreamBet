"use client";

import { motion } from "framer-motion";
import { Activity, CircleDashed } from "lucide-react";
import { NETWORK } from "@/lib/dreamdex/config";
import type { DreamdexMarket, MarketQuote } from "@/lib/dreamdex/market";
import { formatUsd } from "@/lib/format";

interface MarketSentimentProps {
  quote: MarketQuote;
  market: DreamdexMarket | null;
}

/**
 * What the book thinks. On a binary market the UP token's price *is* the
 * crowd's implied probability, so this bar is a reading of the market rather
 * than a tally of which side has more money on it.
 */
export function MarketSentiment({ quote, market }: MarketSentimentProps) {
  const upPct = Math.round(quote.upProbability * 100);

  return (
    <div className="mx-5">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
        <span
          className={`tnum ${quote.isIndicative ? "text-zinc-500" : "text-up-soft"}`}
        >
          {upPct}% UP
        </span>

        {quote.isIndicative ? (
          /* An untraded book has no opinion. Saying "50/50" as though the
             market had priced it would be inventing a quote. */
          <span className="flex items-center gap-1 font-medium text-zinc-500">
            <CircleDashed className="h-3 w-3" strokeWidth={2.4} />
            no trades yet &mdash; odds indicative
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-zinc-500">
            <Activity className="h-3 w-3" strokeWidth={2.4} />
            <span className="tnum">{formatUsd(market?.volume ?? 0)}</span>{" "}
            {NETWORK.collateral.symbol} traded
          </span>
        )}

        <span
          className={`tnum ${quote.isIndicative ? "text-zinc-500" : "text-down-soft"}`}
        >
          {100 - upPct}% DOWN
        </span>
      </div>

      {/* One track, split by an absolutely positioned UP fill: keeps the two
          sides exactly complementary instead of letting flex resolve widths. */}
      <div
        className={`relative h-1.5 overflow-hidden rounded-full transition-opacity ${
          quote.isIndicative ? "bg-zinc-700 opacity-50" : "bg-down/70"
        }`}
      >
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            quote.isIndicative ? "bg-zinc-500" : "bg-up"
          }`}
          initial={false}
          animate={{ width: `${upPct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}
