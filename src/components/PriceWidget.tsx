"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { AssetIcon } from "@/components/icons/AssetIcons";
import type { Asset } from "@/lib/assets";
import type { PriceFeed } from "@/hooks/usePriceFeed";
import { formatClockTime, formatPercent, formatPrice } from "@/lib/format";

interface PriceWidgetProps {
  asset: Asset;
  feed: PriceFeed;
  /**
   * The line the window settles against, drawn on the chart and spelled out.
   * Null until the oracle posts the window's opening price.
   */
  strike: number | null;
  /** Null until a window is known — the server can't know the timezone either. */
  settleAt: number | null;
}

export function PriceWidget({
  asset,
  feed,
  strike,
  settleAt,
}: PriceWidgetProps) {
  const positive = feed.changePct >= 0;
  const Trend = positive ? TrendingUp : TrendingDown;
  // No price or no line means no side to be on. Rendering "DOWN winning" off a
  // missing number would be a claim about money that nothing supports.
  const above =
    feed.price !== null && strike !== null ? feed.price >= strike : null;

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
              {feed.price === null ? (
                <span className="inline-block h-7 w-40 animate-pulse rounded-lg bg-zinc-800 align-middle" />
              ) : (
                formatPrice(feed.price, asset.decimals)
              )}
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

      {/* Absorbs the slack on taller phones so the card never floats. Inset to
          the same px-5 as the header and footer, so the trend line starts and
          ends on the same vertical rule as the price and the strike. */}
      <div className="mt-2 min-h-[88px] w-full flex-1 px-5">
        {feed.history.length > 1 ? (
          <Sparkline
            points={feed.history}
            positive={positive}
            strikePrice={strike ?? undefined}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-zinc-800/40" />
        )}
      </div>

      {/* The bet, in words. Everyone in the window shares this line, so this is
          the sentence that has to land before anyone taps UP or DOWN. */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 px-5 py-2.5">
        <span className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Strike
          </span>
          <span className="tnum block text-[14px] font-semibold text-zinc-200">
            {strike === null ? (
              <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-zinc-800 align-middle" />
            ) : (
              formatPrice(strike, asset.decimals)
            )}
          </span>
        </span>

        <span className="flex flex-col items-end gap-1">
          <span
            className={`tnum flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              above === null
                ? "bg-zinc-800 text-zinc-500"
                : above
                  ? "bg-up/10 text-up-soft"
                  : "bg-down/10 text-down-soft"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-current" />
            {above === null
              ? "Awaiting line"
              : above
                ? "UP winning"
                : "DOWN winning"}
          </span>
          {settleAt !== null ? (
            <span className="text-[10px] font-medium text-zinc-600">
              settles {formatClockTime(settleAt)}
            </span>
          ) : (
            <span className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
          )}
        </span>
      </div>
    </section>
  );
}
