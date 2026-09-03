"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { Challenge } from "@/lib/challenge";

interface ChallengeBannerProps {
  challenge: Challenge;
  onDismiss: () => void;
}

/**
 * Somebody arrived by tapping a challenge link. The link names the side its
 * sender took, so the only thing worth saying here is which side is left — a
 * counter-bet is the entire reason the link was sent, and the app should not
 * make the recipient work out the direction for themselves.
 *
 * It stops short of opening the ticket for them. Arriving from a chat to find a
 * money dialog already open is a different product.
 */
export function ChallengeBanner({ challenge, onDismiss }: ChallengeBannerProps) {
  const theirs = challenge.direction === "up";
  const yours = theirs ? "DOWN" : "UP";
  const who = challenge.from ? `@${challenge.from}` : "Someone";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-5 mb-2 flex items-center gap-2.5 rounded-xl border border-violet-500/25 bg-violet-500/10 py-2 pl-3 pr-2"
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
          theirs ? "bg-up/15 text-up-soft" : "bg-down/15 text-down-soft"
        }`}
      >
        {theirs ? (
          <ArrowUpRight className="h-4 w-4" strokeWidth={3} />
        ) : (
          <ArrowDownRight className="h-4 w-4" strokeWidth={3} />
        )}
      </span>

      <p className="min-w-0 flex-1 text-[11px] font-medium leading-tight text-zinc-300">
        <span className="font-bold text-white">{who}</span> called{" "}
        {challenge.symbol} {theirs ? "UP" : "DOWN"} — take{" "}
        <span className={`font-bold ${theirs ? "text-down-soft" : "text-up-soft"}`}>
          {yours}
        </span>{" "}
        against them.
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors active:text-zinc-300"
        aria-label="Dismiss challenge"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.6} />
      </button>
    </motion.div>
  );
}
