"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { PoolSnapshot } from "@/lib/assets";
import type { Direction } from "@/lib/round";
import { formatDuration } from "@/lib/format";

/** Pre-scaled from the 1024×1536 source renders; dimensions are the file's. */
const ARROW = {
  up: { src: "/arrow-up.webp", width: 159, height: 256 },
  down: { src: "/arrow-down.webp", width: 158, height: 256 },
} as const;

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

/**
 * The arrow renders carry their own colour *and* their own bloom, so the button
 * underneath stays dark: a green glow on a green fill has nothing to bloom
 * against and the arrow disappears into it. The surface keeps its UP/DOWN
 * identity through a tinted wash, the ring, and the halo instead of a fill.
 */
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
  const arrow = ARROW[direction];

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onPredict(direction)}
      whileTap={disabled ? undefined : { scale: 0.955 }}
      animate={{ opacity: disabled ? 0.4 : 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={`group relative isolate flex h-[88px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-zinc-900 font-semibold outline-none ${
        isUp ? "shadow-glow-up" : "shadow-glow-down"
      }`}
    >
      {/* Tinted wash — the colour the fill used to carry, dialled down far
          enough that the arrow still has somewhere to glow. */}
      <span
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b to-transparent ${
          isUp ? "from-up/[0.16]" : "from-down/[0.16]"
        }`}
      />
      {/* Brightens under the finger for a tactile, "charged" feel. */}
      <span className="pointer-events-none absolute inset-0 -z-10 bg-white/0 transition-colors group-active:bg-white/[0.07]" />

      <Image
        src={arrow.src}
        alt=""
        width={arrow.width}
        height={arrow.height}
        priority
        className="h-12 w-auto shrink-0"
      />

      <span className="flex flex-col items-start gap-0.5">
        <span className="whitespace-nowrap text-[15px] tracking-tight text-white">
          {isUp ? "Predict UP" : "Predict DOWN"}
        </span>
        <span
          className={`tnum text-[11px] font-semibold ${
            isUp ? "text-up-soft/80" : "text-down-soft/80"
          }`}
        >
          {payout.toFixed(2)}× payout
        </span>
      </span>
    </motion.button>
  );
}
