"use client";

import { motion } from "framer-motion";
import { ASSETS, type AssetSymbol } from "@/lib/assets";
import { AssetIcon } from "@/components/icons/AssetIcons";

interface AssetSelectorProps {
  selected: AssetSymbol;
  onSelect: (symbol: AssetSymbol) => void;
}

export function AssetSelector({ selected, onSelect }: AssetSelectorProps) {
  return (
    // mx-5 puts the row on the same page margin as the price card below it.
    <div className="no-scrollbar mx-5 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
      {ASSETS.map((asset) => {
        const active = asset.symbol === selected;
        return (
          <motion.button
            key={asset.symbol}
            type="button"
            onClick={() => onSelect(asset.symbol)}
            whileTap={{ scale: 0.94 }}
            className={`relative flex shrink-0 snap-start items-center gap-2 rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold transition-colors ${
              active ? "text-white" : "text-zinc-500"
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
              className={`relative z-10 h-6 w-6 ${active ? "" : "opacity-50 saturate-50"}`}
            />
            <span className="relative z-10">{asset.pair}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
