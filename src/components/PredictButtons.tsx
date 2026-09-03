"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { PoolSnapshot } from "@/lib/assets";
import type { Direction } from "@/lib/round";

interface PredictButtonsProps {
  pool: PoolSnapshot;
  disabled: boolean;
  onPredict: (direction: Direction) => void;
}

export function PredictButtons({
  pool,
  disabled,
  onPredict,
}: PredictButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
      <PredictButton
        direction="up"
        payout={pool.payoutUp}
        disabled={disabled}
        onPredict={onPredict}
      />
      <PredictButton
        direction="down"
        payout={pool.payoutDown}
        disabled={disabled}
        onPredict={onPredict}
      />
    </div>
  );
}

function PredictButton({
  direction,
  payout,
  disabled,
  onPredict,
}: {
  direction: Direction;
  payout: number;
  disabled: boolean;
  onPredict: (direction: Direction) => void;
}) {
  const isUp = direction === "up";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onPredict(direction)}
      whileTap={disabled ? undefined : { scale: 0.955 }}
      animate={{ opacity: disabled ? 0.4 : 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={`group relative isolate flex h-[88px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl font-semibold outline-none ${
        isUp
          ? "bg-gradient-to-b from-up to-emerald-600 text-emerald-950 shadow-glow-up"
          : "bg-gradient-to-b from-down to-rose-600 text-rose-950 shadow-glow-down"
      }`}
    >
      {/* Brightens under the finger for a tactile, "charged" feel. */}
      <span className="pointer-events-none absolute inset-0 -z-10 bg-white/0 transition-colors group-active:bg-white/10" />

      <span className="flex items-center gap-1 text-[19px] tracking-tight">
        <Icon className="h-5 w-5" strokeWidth={3} />
        {isUp ? "Predict UP" : "Predict DOWN"}
      </span>
      <span className="tnum text-[12px] font-semibold opacity-70">
        {payout.toFixed(2)}× payout
      </span>
    </motion.button>
  );
}
