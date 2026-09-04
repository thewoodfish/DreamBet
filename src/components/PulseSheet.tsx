"use client";

import { motion } from "framer-motion";
import { Activity, CircleDashed, Timer, X } from "lucide-react";
import { NETWORK } from "@/lib/dreamdex/config";
import type { DreamdexMarket } from "@/lib/dreamdex/market";
import type { MarketPulseData } from "@/hooks/useMarketPulse";
import {
  COIN_FLIP_REACH,
  formatPctValue,
  readPulse,
  type Closeness,
  type Pulse,
  type WindowOutcome,
} from "@/lib/pulse";
import { formatDuration, formatUsd, windowLabel } from "@/lib/format";
import type { Asset } from "@/lib/assets";

interface PulseSheetProps {
  asset: Asset;
  market: DreamdexMarket | null;
  /** The line this window settles against, null before the opening print. */
  boundary: number | null;
  /** Latest oracle price. */
  price: number | null;
  /** The last hour of 1-minute prints, oldest first. */
  history: number[];
  secondsLeft: number;
  /** Book-implied probability UP wins, or null on an untraded book. */
  upProbability: number | null;
  data: MarketPulseData;
  onClose: () => void;
}

/** How the headline reads at a glance, before anybody parses a number. */
const VERDICT: Record<Closeness, { label: string; chip: string; glow: string }> = {
  unknown: {
    label: "Reading the market",
    chip: "bg-zinc-800 text-zinc-400",
    glow: "from-zinc-700/10",
  },
  "coin-flip": {
    label: "Too close to call",
    chip: "bg-amber-400/15 text-amber-300",
    glow: "from-amber-400/[0.10]",
  },
  leaning: {
    label: "Leaning",
    chip: "bg-violet-500/15 text-violet-300",
    glow: "from-violet-500/[0.10]",
  },
  clear: {
    label: "Clear lead",
    chip: "bg-zinc-800 text-zinc-300",
    glow: "from-zinc-700/10",
  },
};

/**
 * The market pulse: everything happening in this window that the trading screen
 * has no room to say.
 *
 * Every figure is measured, not modelled — oracle prints, contract verdicts, the
 * resting book, recorded bets. The panel deliberately stops at description: it
 * shows how far the line is against how far the price can still travel, and it
 * never tells you which side to take. An app that bets people's money has no
 * business also being the tipster.
 */
export function PulseSheet({
  asset,
  market,
  boundary,
  price,
  history,
  secondsLeft,
  upProbability,
  data,
  onClose,
}: PulseSheetProps) {
  const pulse = readPulse({
    symbol: asset.symbol,
    price,
    boundary,
    history,
    secondsLeft,
    recent: data.recent,
    upProbability,
    book: data.book,
    group: data.group,
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm"
      />

      <motion.section
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="absolute inset-x-0 bottom-0 z-50 flex max-h-[88%] flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-950"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-zinc-700" />

        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3">
          <div className="leading-tight">
            <h2 className="text-[17px] font-semibold tracking-tight">
              Market pulse
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
              <span className="text-zinc-400">{asset.symbol}</span>
              {market && (
                <>
                  <Dot />
                  {windowLabel(market.windowSeconds)} window
                  <Dot />
                  {/* The whole reading is relative to the time left, and this
                      sheet covers the countdown that would otherwise say so. */}
                  <span className="tnum inline-flex items-center gap-1 text-zinc-400">
                    <Timer className="h-3 w-3" strokeWidth={2.6} />
                    {formatDuration(secondsLeft)} left
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-500 transition-colors active:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </header>

        <div className="no-scrollbar min-h-0 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          {market === null ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              <Headline
                pulse={pulse}
                symbol={asset.symbol}
                secondsLeft={secondsLeft}
              />

              <Outcomes recent={data.recent} loading={data.loading} />

              <div className="grid grid-cols-2 gap-3">
                <Tile
                  label="Typical 1-min move"
                  hint="median, last hour"
                  loading={false}
                  value={
                    pulse.typicalMovePct === null ? null : (
                      <span className="tnum">
                        ±{formatPctValue(pulse.typicalMovePct)}
                      </span>
                    )
                  }
                />
                <Tile
                  label="Resting book"
                  hint="orders to cross now"
                  loading={data.loading}
                  value={
                    data.book === null ? null : data.book.upOffers +
                        data.book.downOffers ===
                      0 ? (
                      <span className="text-[13px] font-medium text-zinc-600">
                        empty
                      </span>
                    ) : (
                      <span className="tnum">
                        <span className="text-up-soft">{data.book.upOffers}</span>
                        <span className="text-zinc-700"> / </span>
                        <span className="text-down-soft">
                          {data.book.downOffers}
                        </span>
                      </span>
                    )
                  }
                />
              </div>

              <Crowd group={data.group} loading={data.loading} />

              <p className="px-1 pt-1 text-[10px] leading-relaxed text-zinc-600">
                Read from the contracts and the oracle — past windows are their
                settled verdicts, not guesses from the chart. None of it predicts
                the next one.
              </p>
            </div>
          )}
        </div>
      </motion.section>
    </>
  );
}

function Dot() {
  return <span className="text-zinc-700">·</span>;
}

/**
 * The headline: how far the line is, and whether that is far at all.
 *
 * The number alone was never the story — 0.04% means nothing until it is set
 * against how far this asset travels in the time left — so the number and the
 * track that gives it scale share a card, and the sentence underneath says in
 * words what the track says in space.
 */
function Headline({
  pulse,
  symbol,
  secondsLeft,
}: {
  pulse: Pulse;
  symbol: string;
  secondsLeft: number;
}) {
  const tone = VERDICT[pulse.closeness];
  const up = pulse.leader === "up";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-card">
      {/* The verdict's colour washes the card rather than only tinting a chip,
          so the reading registers before a single number is parsed. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent ${tone.glow}`}
      />

      <div className="relative p-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${tone.chip}`}
        >
          <Activity className="h-3 w-3" strokeWidth={2.6} />
          {tone.label}
        </span>

        {pulse.distancePct === null ? (
          <p className="mt-3 text-[15px] font-medium leading-snug text-zinc-300">
            {pulse.sentence}
          </p>
        ) : (
          <>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span
                className={`tnum font-mono text-[38px] font-bold leading-none tracking-tight ${
                  up ? "text-up-soft" : "text-down-soft"
                }`}
              >
                {up ? "+" : "−"}
                {formatPctValue(pulse.distancePct)}
              </span>
              <span className="text-[12px] font-medium text-zinc-500">
                {up ? "above" : "below"} the line
              </span>
            </div>

            <ReachTrack
              reach={pulse.reach}
              up={up}
              symbol={symbol}
              secondsLeft={secondsLeft}
            />

            <p className="mt-3.5 border-t border-zinc-800/70 pt-3 text-[13px] font-medium leading-snug text-zinc-300">
              {pulse.sentence}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Where the price sits between the two outcomes, scaled by how far it can
 * still travel before the window closes.
 *
 * The band is everything within one window's worth of ordinary movement, so a
 * dot inside it means the line is reachable and a dot outside means the price
 * would have to move unusually hard to get back. That is the same comparison
 * `classifyReach` makes, drawn rather than asserted — the amber core is
 * literally the region the copy calls too close to call, so the picture and the
 * words cannot disagree.
 */
function ReachTrack({
  reach,
  up,
  symbol,
  secondsLeft,
}: {
  reach: number | null;
  up: boolean;
  symbol: string;
  secondsLeft: number;
}) {
  // The band is a third of the track either side of the line, leaving room to
  // show a price that has run past its reach rather than pinning it to the end.
  const BAND = 32;
  const core = BAND * COIN_FLIP_REACH;
  const offset = reach === null ? 0 : Math.max(Math.min(reach * BAND, 46), -46);

  return (
    <div className="mt-4">
      <div className="relative h-9 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950">
        {/* Everything the price can still reach before expiry. This region is
            the whole point of the track, so it carries an edge rather than a
            wash — without one it reads as a slightly lighter nothing. */}
        <div
          aria-hidden
          className="absolute inset-y-0 rounded-lg bg-zinc-800/70 ring-1 ring-inset ring-zinc-700/50"
          style={{ left: `${50 - BAND}%`, width: `${BAND * 2}%` }}
        />
        {/* Close enough that calling either side would be inventing confidence. */}
        <div
          aria-hidden
          className="absolute inset-y-0 bg-amber-400/[0.07]"
          style={{ left: `${50 - core}%`, width: `${core * 2}%` }}
        />
        {/* The line itself, dashed exactly as the price chart draws it. */}
        <div
          aria-hidden
          className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom,#a1a1aa 0 4px,transparent 4px 8px)",
          }}
        />

        {reach !== null && (
          <motion.span
            aria-hidden
            initial={false}
            animate={{ left: `${50 + offset}%` }}
            transition={{ type: "spring", stiffness: 210, damping: 26 }}
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950 ${
              up ? "bg-up shadow-glow-up" : "bg-down shadow-glow-down"
            }`}
          />
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between px-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
        <span className="text-down-soft/70">Down wins</span>
        <span className="text-zinc-600">The line</span>
        <span className="text-up-soft/70">Up wins</span>
      </div>

      {/* Without this the shaded region is decoration. With it, the whole
          picture explains itself and the number above it stops being abstract. */}
      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
        Shaded band is how far {symbol} usually travels in the{" "}
        <span className="tnum">{formatDuration(secondsLeft)}</span> left.
      </p>
    </div>
  );
}

/** How the last windows on this cadence actually settled. */
function Outcomes({
  recent,
  loading,
}: {
  recent: WindowOutcome[];
  loading: boolean;
}) {
  const ups = recent.filter((o) => o === "up").length;
  const downs = recent.filter((o) => o === "down").length;
  const voids = recent.filter((o) => o === "void").length;

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Last {recent.length || 6} windows
        </h3>
        {recent.length > 0 && (
          <p className="tnum text-[10px] font-medium text-zinc-600">
            {ups} up · {downs} down{voids > 0 ? ` · ${voids} void` : ""}
          </p>
        )}
      </div>

      {loading && recent.length === 0 ? (
        <div className="mt-2.5 flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="h-7 flex-1 animate-pulse rounded-lg bg-zinc-800"
            />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="mt-2 text-[12px] text-zinc-600">
          Nothing has settled on this cadence yet.
        </p>
      ) : (
        <>
          {/* Reversed, so the row reads left to right as time. */}
          <div className="mt-2.5 flex gap-1.5">
            {[...recent].reverse().map((outcome, i) => (
              <OutcomeBar key={i} outcome={outcome} />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">oldest → newest</p>
        </>
      )}
    </section>
  );
}

/**
 * One settled window, drawn as a bar that sits high for UP and low for DOWN, so
 * the row reads as a shape before it reads as six separate marks. A void is
 * flat and grey: nobody won it, and nobody lost anything either.
 */
function OutcomeBar({ outcome }: { outcome: WindowOutcome }) {
  if (outcome === "void") {
    return (
      <span
        title="voided — stakes returned"
        className="relative h-7 flex-1 rounded-lg bg-zinc-800/50"
      >
        <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-zinc-600" />
      </span>
    );
  }

  const up = outcome === "up";
  return (
    <span
      title={up ? "closed up" : "closed down"}
      className={`relative h-7 flex-1 rounded-lg ${up ? "bg-up/15" : "bg-down/15"}`}
    >
      <span
        className={`absolute inset-x-2 h-1 rounded-full ${
          up ? "top-1.5 bg-up-soft" : "bottom-1.5 bg-down-soft"
        }`}
      />
    </span>
  );
}

/** A single figure, sized to sit two-across. */
function Tile({
  label,
  hint,
  value,
  loading,
}: {
  label: string;
  hint: string;
  value: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-[17px] font-semibold tracking-tight text-zinc-200">
        {loading ? (
          <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-800 align-middle" />
        ) : value === null ? (
          <span className="text-[13px] font-medium text-zinc-600">
            unavailable
          </span>
        ) : (
          value
        )}
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>
    </div>
  );
}

/** Who is already in this window, as a tally and never as names. */
function Crowd({
  group,
  loading,
}: {
  group: MarketPulseData["group"];
  loading: boolean;
}) {
  const mine = group?.scope === "group";
  const total = group ? group.up + group.down : 0;
  const upShare = group && total > 0 ? (group.up / total) * 100 : 50;

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          {mine ? "Your group" : "All players"}
        </h3>
        {group && total > 0 && (
          <p className="tnum text-[10px] font-medium text-zinc-600">
            {formatUsd(group.upStake + group.downStake)}{" "}
            {NETWORK.collateral.symbol} in
          </p>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-1.5 animate-pulse rounded-full bg-zinc-800" />
      ) : group === null ? (
        <p className="mt-2 text-[12px] text-zinc-600">
          Standings are unavailable.
        </p>
      ) : total === 0 ? (
        <p className="mt-2 text-[12px] text-zinc-600">
          Nobody has bet this window yet.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline justify-between text-[12px] font-semibold">
            <span className="tnum text-up-soft">{group.up} UP</span>
            <span className="tnum text-down-soft">{group.down} DOWN</span>
          </div>
          <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-down/70">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-up"
              initial={false}
              animate={{ width: `${upShare}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
        </>
      )}
    </section>
  );
}

/** Nothing open means there is no window to have a pulse. */
function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <CircleDashed className="h-6 w-6 text-zinc-700" strokeWidth={2} />
      <p className="text-[13px] font-medium text-zinc-400">
        No window open right now
      </p>
      <p className="max-w-[16rem] text-[11px] leading-relaxed text-zinc-600">
        There is nothing to read until the venue rolls the next one. The pulse
        comes back with it.
      </p>
    </div>
  );
}
