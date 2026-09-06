"use client";

import { motion } from "framer-motion";
import { Flame, Send } from "lucide-react";
import type { Asset } from "@/lib/assets";
import { NETWORK } from "@/lib/dreamdex/config";
import type { Position } from "@/lib/round";
import { netResult } from "@/lib/round";
import type { Settlement } from "@/hooks/useSettlement";
import { formatPrice, formatUsd } from "@/lib/format";

interface SettlementOverlayProps {
  asset: Asset;
  position: Position;
  /** What the contract decided — never a locally computed result. */
  settlement: Settlement;
  streak: number;
  /** The bet was placed in an earlier session and settled while the app was shut. */
  whileAway?: boolean;
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
  settlement,
  streak,
  whileAway = false,
  onShare,
  onNextRound,
}: SettlementOverlayProps) {
  const { winner, price, voided } = settlement;
  const won = winner === position.direction;
  const net = netResult(position, winner);

  /**
   * Only a win gets the fanfare.
   *
   * The two results used to share one animation and differ by colour alone,
   * which made winning feel exactly like losing — and this screen is the whole
   * reason anybody plays a second round. A loss stays deliberately quiet: it is
   * a miss, not a failure, and an app that performs at somebody who just lost
   * money is an app they close.
   */
  const celebrate = won && !voided;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/95 px-6 backdrop-blur-md"
    >
      {/* Result-coloured bloom behind the number. A win's swells past its
          resting size before settling; a loss simply arrives. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: celebrate ? 0.4 : 0.8 }}
        animate={
          celebrate
            ? { opacity: 1, scale: [0.4, 1.18, 1] }
            : { opacity: 1, scale: 1 }
        }
        transition={{ duration: celebrate ? 0.75 : 0.4, ease: "easeOut" }}
        className={`pointer-events-none absolute rounded-full blur-3xl ${
          celebrate ? "h-96 w-96 bg-up/30" : "h-64 w-64 bg-down/15"
        }`}
      />

      {celebrate && <Sparks />}

      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.06 }}
        className="relative flex flex-col items-center text-center"
      >
        {/* A result that appears the instant the app opens, with no tap behind
            it, reads as a glitch unless it says where it came from. */}
        {whileAway && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Settled while you were away
          </p>
        )}

        <p
          className={`text-[13px] font-bold uppercase tracking-[0.2em] ${
            voided ? "text-zinc-400" : won ? "text-up-soft" : "text-down-soft"
          }`}
        >
          {/* A void is not a loss: the oracle declined to answer and the stake
              comes back, so it must never be dressed up as one. */}
          {voided ? "Round voided" : won ? "You won" : "Missed it"}
        </p>

        {/* The number is the payload. On a win it overshoots and settles, which
            is what reads as a punch; on a loss it just fades up. */}
        <motion.p
          initial={{ scale: celebrate ? 0.5 : 1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            celebrate
              ? { type: "spring", stiffness: 420, damping: 11, delay: 0.16 }
              : { duration: 0.3, ease: "easeOut", delay: 0.1 }
          }
          className={`tnum mt-2 text-[52px] font-bold leading-none tracking-tight ${
            won ? "text-white" : "text-zinc-400"
          }`}
        >
          {net >= 0 ? "+" : "−"}
          {formatUsd(Math.abs(net))}
        </motion.p>
        <p className="mt-1 text-[12px] font-medium text-zinc-500">
          {NETWORK.collateral.symbol}
        </p>

        <p className="mt-5 text-[12px] font-medium text-zinc-500">
          {voided ? (
            <>
              {asset.pair} returned your stake &mdash; the oracle posted no
              answer for this window
              <br />
            </>
          ) : (
            <>
              {asset.pair} settled at{" "}
              <span className="tnum font-semibold text-zinc-300">
                {price === null ? "—" : formatPrice(price, asset.decimals)}
              </span>
              <br />
            </>
          )}
          you called{" "}
          <span
            className={`font-bold ${won ? "text-up-soft" : "text-down-soft"}`}
          >
            {position.direction === "up" ? "UP" : "DOWN"}
          </span>{" "}
          against an opening price of{" "}
          <span className="tnum font-semibold text-zinc-300">
            {formatPrice(position.strike, asset.decimals)}
          </span>
        </p>

        {/* Streak is the thing that makes tomorrow's round matter. */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: celebrate ? 0.7 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            celebrate
              ? { type: "spring", stiffness: 480, damping: 13, delay: 0.5 }
              : { delay: 0.32 }
          }
          className={`mt-6 flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold ${
            won && !voided
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-500"
          }`}
        >
          <Flame className="h-4 w-4" strokeWidth={2.5} />
          {voided ? "Streak held" : won ? `${streak} in a row` : "Streak reset"}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: celebrate ? 0.6 : 0.42 }}
        className="absolute inset-x-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2.5"
      >
        <motion.button
          type="button"
          onClick={onShare}
          whileTap={{ scale: 0.97 }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-[16px] font-bold text-white shadow-lg shadow-indigo-950/60"
        >
          <Send className="h-4.5 w-4.5" strokeWidth={2.5} />
          {won && !voided ? "Brag in the group" : "Challenge the group"}
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

/**
 * Deterministic, so the burst is identical on every render and on both sides of
 * hydration — a random scatter here would be a different screen each time React
 * re-rendered, and this one is meant to be remembered.
 */
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 96 + ((i * 37) % 64);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    size: 4 + ((i * 13) % 4),
    delay: 0.1 + (i % 6) * 0.035,
  };
});

/** A one-off burst behind the number. Wins only, and gone inside a second. */
function Sparks() {
  return (
    <div aria-hidden className="pointer-events-none absolute">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: s.x, y: s.y, scale: [0, 1, 1, 0.4] }}
          transition={{ duration: 1, delay: s.delay, ease: "easeOut", times: [0, 0.15, 0.6, 1] }}
          className="absolute rounded-full bg-up-soft"
          style={{ width: s.size, height: s.size }}
        />
      ))}
    </div>
  );
}
