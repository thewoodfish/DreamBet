"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { haptic } from "@/lib/telegram";
import type { MarketQuote } from "@/lib/dreamdex/market";
import type { Direction } from "@/lib/round";

/** Pre-scaled from the 1024×1536 source renders; dimensions are the file's. */
const ARROW = {
  up: { src: "/arrow-up.webp", width: 159, height: 256 },
  down: { src: "/arrow-down.webp", width: 158, height: 256 },
} as const;

interface PredictButtonsProps {
  /** Live odds off the dreamDEX book. */
  quote: MarketQuote;
  /** A window is open and has a strike, so a bet can actually be placed. */
  bettable: boolean;
  /** Still finding the window — say nothing rather than "closed". */
  loading: boolean;
  /** Window is open but the oracle has yet to post the line it settles against. */
  awaitingStrike: boolean;
  onPredict: (direction: Direction) => void;
}

export function PredictButtons({
  quote,
  bettable,
  loading,
  awaitingStrike,
  onPredict,
}: PredictButtonsProps) {
  return (
    <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
      {/* Every reason a bet can't be placed right now is stated, rather than
          left as two dead buttons with no explanation. */}
      {loading && (
        <Notice>
          <Loader2
            className="h-3 w-3 shrink-0 animate-spin text-zinc-500"
            strokeWidth={2.4}
          />
          Finding the live window
        </Notice>
      )}

      {/* The oracle posts the opening price a moment after a window opens, and
          that print is the line the bet settles against. Betting before it
          lands would be betting against a number nobody has seen. */}
      {!loading && awaitingStrike && (
        <Notice>
          <Loader2
            className="h-3 w-3 shrink-0 animate-spin text-zinc-500"
            strokeWidth={2.4}
          />
          Waiting for this window&rsquo;s opening price
        </Notice>
      )}

      {/* Windows roll continuously, so this is a gap of seconds between one
          closing and the next opening. */}
      {!loading && !awaitingStrike && !bettable && (
        <Notice>
          <Lock className="h-3 w-3 shrink-0 text-zinc-500" strokeWidth={2.4} />
          This round is closing — the next window opens shortly
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3">
        <PredictButton
          direction="up"
          payout={quote.payoutUp}
          indicative={quote.isIndicative}
          disabled={!bettable}
          onPredict={onPredict}
        />
        <PredictButton
          direction="down"
          payout={quote.payoutDown}
          indicative={quote.isIndicative}
          disabled={!bettable}
          onPredict={onPredict}
        />
      </div>
    </div>
  );
}

/** The status line above the buttons — one look for every reason to explain. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-1.5 text-[11px] font-medium text-zinc-400"
    >
      {children}
    </motion.p>
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
  indicative,
  disabled,
  onPredict,
}: {
  direction: Direction;
  payout: number;
  /** The book has never traded, so this multiplier is a placeholder. */
  indicative: boolean;
  disabled: boolean;
  onPredict: (direction: Direction) => void;
}) {
  const isUp = direction === "up";
  const arrow = ARROW[direction];

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        // The buzz is the confirmation that the tap registered, so it fires
        // with the tap rather than after whatever the tap opens.
        haptic.tap();
        onPredict(direction);
      }}
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
          {payout.toFixed(2)}× {indicative ? "est. payout" : "payout"}
        </span>
      </span>
    </motion.button>
  );
}
