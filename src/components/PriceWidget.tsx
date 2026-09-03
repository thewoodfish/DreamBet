"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { AssetIcon } from "@/components/icons/AssetIcons";
import type { Asset } from "@/lib/assets";
import type { PriceFeed } from "@/hooks/usePriceFeed";
import { formatPercent, formatPrice } from "@/lib/format";

interface PriceWidgetProps {
  asset: Asset;
  feed: PriceFeed;
  /** Set while the user holds a position, to mark their entry on the chart. */
  entryPrice?: number;
}

export function PriceWidget({ asset, feed, entryPrice }: PriceWidgetProps) {
  const positive = feed.changePct >= 0;
  const Trend = positive ? TrendingUp : TrendingDown;

  return (
    <section className="relative mx-5 flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/50 shadow-card">
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <AssetIcon symbol={asset.symbol} className="h-4 w-4" />
            {asset.name}
          </p>

          {/* A single node that re-tints per tick. Cross-fading two copies here
              ghosted the old and new price on top of each other. */}
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[15px] font-medium text-zinc-500">$</span>
            <span
              className={`tnum text-[32px] font-semibold leading-none tracking-tight transition-colors duration-300 ${
                feed.flash === "up"
                  ? "text-up-soft"
                  : feed.flash === "down"
                    ? "text-down-soft"
                    : "text-white"
              }`}
            >
              {formatPrice(feed.price, asset.decimals)}
            </span>
          </div>
        </div>

        <span
          className={`tnum mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold ${
            positive ? "bg-up/10 text-up-soft" : "bg-down/10 text-down-soft"
          }`}
        >
          <Trend className="h-3.5 w-3.5" strokeWidth={2.5} />
          {formatPercent(feed.changePct)}
        </span>
      </div>

      {/* Absorbs the slack on taller phones so the card never floats. */}
      <div className="mt-2 min-h-[88px] w-full flex-1">
        <Sparkline
          points={feed.history}
          positive={positive}
          entryPrice={entryPrice}
        />
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Last 1H
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-600">
          <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-up" />
          Live
        </span>
      </div>
    </section>
  );
}
