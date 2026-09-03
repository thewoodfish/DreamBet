"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Lock } from "lucide-react";
import type { PoolSnapshot } from "@/lib/assets";
import type { Direction } from "@/lib/round";
import { formatDuration } from "@/lib/format";

interface PredictButtonsProps {
  pool: PoolSnapshot;
  /** The current window stopped accepting bets; these now target the next one. */
  locked: boolean;
  /** False until the client clock ticks — we don't know which window we're in yet. */
  ready: boolean;
  /** Seconds until the current window closes, i.e. until the next one opens. */
  secondsLeft: number;
  onPredict: (direction: Direction) => void;
}

export function PredictButtons({
  pool,
  locked,
  ready,
  secondsLeft,
  onPredict,
}: PredictButtonsProps) {
  return (
    <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
      {/* A locked window used to dead-end the whole screen. Betting never stops
          now — it rolls onto the next window, and this line says so. */}
      {locked && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-1.5 text-[11px] font-medium text-zinc-400"
        >
          <Lock className="h-3 w-3 shrink-0 text-zinc-500" strokeWidth={2.4} />
          This round is settling — you&rsquo;re betting the next one, opens in{" "}
          <span className="tnum font-mono font-semibold text-zinc-200">
            {formatDuration(secondsLeft)}
          </span>
        </motion.p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <PredictButton
          direction="up"
          payout={pool.payoutUp}
          disabled={!ready}
          onPredict={onPredict}
        />
        <PredictButton
          direction="down"
          payout={pool.payoutDown}
          disabled={!ready}
          onPredict={onPredict}
        />
      </div>
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
