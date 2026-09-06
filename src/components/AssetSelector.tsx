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
    // shrink-0 because a horizontal scroller is not protected by the usual
    // min-height floor: on a short screen this row was squeezed to a four-pixel
    // sliver rather than being something the screen scrolled to reach.
    <div className="no-scrollbar mx-5 mt-3 flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
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
            {/* The paused mark rides on the icon rather than trailing the
                label. The row scrolls horizontally, and anything after the
                last pill's text sits past the container's edge — which is
                exactly where the mark would be needed, since the dark asset
                is the one at the end of the row. */}
            <span className="relative z-10 shrink-0">
              <AssetIcon
                symbol={asset.symbol}
                className={`h-6 w-6 transition-[filter,opacity] ${
                  active
                    ? ""
                    : paused
                      ? "opacity-30 grayscale"
                      : "opacity-50 saturate-50"
                }`}
              />
              {paused && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-zinc-500 ring-2 ring-zinc-950"
                />
              )}
            </span>
            <span className="relative z-10">{asset.pair}</span>
            {paused && <span className="sr-only">paused — no window open</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
