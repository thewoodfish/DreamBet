"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { PoolSnapshot } from "@/lib/assets";

export type Direction = "up" | "down";

interface PredictButtonsProps {
  pool: PoolSnapshot;
  disabled: boolean;
  /** Currently armed side. Step 2 opens the trade ticket off this same state. */
  active: Direction | null;
  onPredict: (direction: Direction) => void;
}

export function PredictButtons({
  pool,
  disabled,
  active,
  onPredict,
}: PredictButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
      <PredictButton
        direction="up"
        payout={pool.payoutUp}
        disabled={disabled}
        active={active}
        onPredict={onPredict}
      />
      <PredictButton
        direction="down"
        payout={pool.payoutDown}
        disabled={disabled}
        active={active}
        onPredict={onPredict}
      />
    </div>
  );
}

function PredictButton({
  direction,
  payout,
  disabled,
  active,
  onPredict,
}: {
  direction: Direction;
  payout: number;
  disabled: boolean;
  active: Direction | null;
  onPredict: (direction: Direction) => void;
}) {
  const isUp = direction === "up";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  const isActive = active === direction;
  const isDimmed = active !== null && !isActive;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onPredict(direction)}
      whileTap={disabled ? undefined : { scale: 0.955 }}
      animate={{ opacity: disabled ? 0.4 : isDimmed ? 0.45 : 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      aria-pressed={isActive}
      className={`group relative isolate flex h-[88px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl font-semibold outline-none ${
        isUp
          ? "bg-gradient-to-b from-up to-emerald-600 text-emerald-950"
          : "bg-gradient-to-b from-down to-rose-600 text-rose-950"
      } ${
        isActive
          ? isUp
            ? "shadow-glow-up ring-2 ring-up-soft ring-offset-2 ring-offset-zinc-950"
            : "shadow-glow-down ring-2 ring-down-soft ring-offset-2 ring-offset-zinc-950"
          : isUp
            ? "shadow-glow-up"
            : "shadow-glow-down"
      }`}
    >
      {/* Brightens under the finger, and stays lit while this side is armed. */}
      <span
        className={`pointer-events-none absolute inset-0 -z-10 transition-colors group-active:bg-white/10 ${
          isActive ? "bg-white/10" : "bg-white/0"
        }`}
      />

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
