"use client";

import { motion } from "framer-motion";
import { ASSETS, type AssetSymbol } from "@/lib/assets";

interface AssetSelectorProps {
  selected: AssetSymbol;
  onSelect: (symbol: AssetSymbol) => void;
}

export function AssetSelector({ selected, onSelect }: AssetSelectorProps) {
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1">
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
            <span
              className={`relative z-10 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-black/80 ${asset.accent} ${
                active ? "" : "opacity-50 saturate-50"
              }`}
            >
              {asset.symbol.slice(0, 1)}
            </span>
            <span className="relative z-10">{asset.pair}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
