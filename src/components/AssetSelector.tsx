"use client";

import { motion } from "framer-motion";
import { ASSETS, type AssetSymbol } from "@/lib/assets";
import { AssetIcon } from "@/components/icons/AssetIcons";
import type { AssetLivenessMap } from "@/hooks/useAssetLiveness";

interface AssetSelectorProps {
  selected: AssetSymbol;
  /** Which pills have a window open. Unknown assets stay selectable. */
  liveness: AssetLivenessMap;
  onSelect: (symbol: AssetSymbol) => void;
}

/**
 * The pill row, which now carries a second piece of information: whether there
 * is anything behind each pill to bet on.
 *
 * dreamDEX's market creators are per-asset and intermittent, so an asset can be
 * dark for hours while its neighbours roll normally. A row that hid that would
 * be offering taps that lead to a paused screen, so a dark asset is dimmed and
 * cannot be selected — except the one already selected, which stays put rather
 * than leaving the screen with nothing chosen.
 */
export function AssetSelector({
  selected,
  liveness,
  onSelect,
}: AssetSelectorProps) {
  return (
    // mx-5 puts the row on the same page margin as the price card below it.
    <div className="no-scrollbar mx-5 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
      {ASSETS.map((asset) => {
        const active = asset.symbol === selected;
        const paused = liveness[asset.symbol] === "paused";
        // Nothing to switch to, so the tap is refused rather than answered with
        // a paused screen. The active pill is never locked out of itself.
        const disabled = paused && !active;

        return (
          <motion.button
            key={asset.symbol}
            type="button"
            onClick={() => onSelect(asset.symbol)}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.94 }}
            title={paused ? `${asset.symbol} has no window open` : undefined}
            className={`relative flex shrink-0 snap-start items-center gap-2 rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold transition-colors ${
              active
                ? "text-white"
                : paused
                  ? "text-zinc-600"
                  : "text-zinc-500"
            }`}
          >
            {active && (
              <motion.span
                layoutId="asset-pill"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-full border border-zinc-700 bg-zinc-800/90"
              />
            )}
            <AssetIcon
              symbol={asset.symbol}
              className={`relative z-10 h-6 w-6 transition-[filter,opacity] ${
                active
                  ? ""
                  : paused
                    ? "opacity-30 grayscale"
                    : "opacity-50 saturate-50"
              }`}
            />
            <span className="relative z-10">{asset.pair}</span>
            {paused && (
              // Small enough not to compete with the pair, present enough to
              // explain why the pill looks spent.
              <span className="relative z-10 flex items-center">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-zinc-600"
                />
                <span className="sr-only">paused — no window open</span>
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
