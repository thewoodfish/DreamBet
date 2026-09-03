"use client";

import { motion } from "framer-motion";
import { Flame, Send } from "lucide-react";
import type { Asset } from "@/lib/assets";
import type { Position } from "@/lib/round";
import { didWin, netResult } from "@/lib/round";
import { formatPrice, formatUsd } from "@/lib/format";

interface SettlementOverlayProps {
  asset: Asset;
  position: Position;
  settlePrice: number;
  streak: number;
  onShare: () => void;
  onNextRound: () => void;
}

/**
 * Full takeover the instant the window closes. This is the emotional peak of the
 * product, and deliberately the place we ask for the share: "I won" travels much
 * further in a group chat than "I bet".
 */
export function SettlementOverlay({
  asset,
  position,
  settlePrice,
  streak,
  onShare,
  onNextRound,
}: SettlementOverlayProps) {
  const won = didWin(position, settlePrice);
  const net = netResult(position, settlePrice);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/95 px-6 backdrop-blur-md"
    >
      {/* Result-coloured bloom behind the number. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`pointer-events-none absolute h-72 w-72 rounded-full blur-3xl ${
          won ? "bg-up/25" : "bg-down/20"
        }`}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.06 }}
        className="relative flex flex-col items-center text-center"
      >
        <p
          className={`text-[13px] font-bold uppercase tracking-[0.2em] ${
            won ? "text-up-soft" : "text-down-soft"
          }`}
        >
          {won ? "You won" : "Missed it"}
        </p>

        <p
          className={`tnum mt-2 text-[52px] font-bold leading-none tracking-tight ${
            won ? "text-white" : "text-zinc-400"
          }`}
        >
          {net >= 0 ? "+" : "−"}
          {formatUsd(Math.abs(net))}
        </p>
        <p className="mt-1 text-[12px] font-medium text-zinc-500">USDso</p>

        <p className="mt-5 text-[12px] font-medium text-zinc-500">
          {asset.pair} settled at{" "}
          <span className="tnum font-semibold text-zinc-300">
            {formatPrice(settlePrice, asset.decimals)}
          </span>
          <br />
          you called{" "}
          <span
            className={`font-bold ${won ? "text-up-soft" : "text-down-soft"}`}
          >
            {position.direction === "up" ? "UP" : "DOWN"}
          </span>{" "}
          against a strike of{" "}
          <span className="tnum font-semibold text-zinc-300">
            {formatPrice(position.strike, asset.decimals)}
          </span>
        </p>

        {/* Streak is the thing that makes tomorrow's round matter. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className={`mt-6 flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold ${
            won
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-500"
          }`}
        >
          <Flame className="h-4 w-4" strokeWidth={2.5} />
          {won ? `${streak} in a row` : "Streak reset"}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="absolute inset-x-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2.5"
      >
        <motion.button
          type="button"
          onClick={onShare}
          whileTap={{ scale: 0.97 }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-[16px] font-bold text-white shadow-lg shadow-indigo-950/60"
        >
          <Send className="h-4.5 w-4.5" strokeWidth={2.5} />
          {won ? "Brag in the group" : "Challenge the group"}
        </motion.button>

        <button
          type="button"
          onClick={onNextRound}
          className="h-11 w-full rounded-2xl text-[14px] font-semibold text-zinc-500 transition-colors active:text-zinc-300"
        >
          Next round
        </button>
      </motion.div>
    </motion.div>
  );
}
