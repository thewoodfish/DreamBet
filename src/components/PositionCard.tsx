"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react";
import type { Asset } from "@/lib/assets";
import type { Position } from "@/lib/round";
import { didWin } from "@/lib/round";
import { formatDuration, formatPrice, formatUsd } from "@/lib/format";

interface PositionCardProps {
  asset: Asset;
  position: Position;
  currentPrice: number;
  /** True while the position is queued for a window that hasn't opened yet. */
  pending: boolean;
  /** Seconds until the position's window opens (pending) or closes (live). */
  secondsLeft: number;
}

/**
 * Takes the place of the UP/DOWN buttons once the user is in. The point is that
 * the wait stops being dead time: the chart now has the strike on it and this
 * card tells them, live, whether they're on the right side of it.
 */
export function PositionCard({
  asset,
  position,
  currentPrice,
  pending,
  secondsLeft,
}: PositionCardProps) {
  const isUp = position.direction === "up";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  const winning = didWin(position, currentPrice);
  const toWin = position.stake * position.payoutMultiplier;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`mx-5 overflow-hidden rounded-2xl border bg-zinc-900/60 shadow-card ${
        pending
          ? "border-zinc-700"
          : winning
            ? "border-up/40"
            : "border-down/40"
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold ${
              isUp ? "bg-up/15 text-up-soft" : "bg-down/15 text-down-soft"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={3} />
            {isUp ? "UP" : "DOWN"}
          </span>
          <span className="tnum text-[15px] font-semibold">
            {formatUsd(position.stake)}{" "}
            <span className="text-[11px] font-medium text-zinc-500">USDso</span>
          </span>
        </span>

        {/* Live verdict — the reason to keep watching. Withheld while the
            position is queued, because there is no verdict yet to give. */}
        {pending ? (
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-400">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />
            NEXT ROUND
          </span>
        ) : (
          <span
            className={`flex items-center gap-1.5 text-[12px] font-bold ${
              winning ? "text-up-soft" : "text-down-soft"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 animate-pulse-ring rounded-full ${
                winning ? "bg-up" : "bg-down"
              }`}
            />
            {winning ? "WINNING" : "LOSING"}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-3 divide-x divide-zinc-800/80 border-t border-zinc-800/80 text-center">
        <Stat
          label="Strike"
          value={formatPrice(position.strike, asset.decimals)}
        />
        {pending ? (
          <Stat
            label="Starts in"
            value={formatDuration(secondsLeft)}
            tone="text-zinc-300"
          />
        ) : (
          <Stat label="Now" value={formatPrice(currentPrice, asset.decimals)} />
        )}
        <Stat
          label="To win"
          value={formatUsd(toWin)}
          tone={!pending && winning ? "text-up-soft" : "text-zinc-400"}
        />
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone = "text-zinc-200",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="py-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className={`tnum mt-0.5 text-[13px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
