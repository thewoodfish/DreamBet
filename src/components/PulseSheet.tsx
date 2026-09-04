"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CircleDashed,
  Minus,
  Users,
  X,
} from "lucide-react";
import { NETWORK } from "@/lib/dreamdex/config";
import type { DreamdexMarket } from "@/lib/dreamdex/market";
import type { MarketPulseData } from "@/hooks/useMarketPulse";
import {
  formatPctValue,
  readPulse,
  type Closeness,
  type WindowOutcome,
} from "@/lib/pulse";
import { formatUsd, windowLabel } from "@/lib/format";
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
const VERDICT: Record<Closeness, { label: string; tone: string }> = {
  unknown: { label: "Reading the market", tone: "bg-zinc-800 text-zinc-400" },
  "coin-flip": { label: "Too close to call", tone: "bg-amber-400/15 text-amber-300" },
  leaning: { label: "Leaning", tone: "bg-violet-500/15 text-violet-300" },
  clear: { label: "Clear lead", tone: "bg-up/15 text-up-soft" },
};

/**
 * The market pulse: everything happening in this window that the trading screen
 * has no room to say.
 *
 * Every figure is measured, not modelled — oracle prints, contract verdicts, the
 * resting book, recorded bets. The panel deliberately stops at description: it
 * will tell you the price is a minute of ordinary movement away from the line
 * with four minutes to run, and it will never tell you which side to take. An
 * app that bets people's money has no business also being the tipster.
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

  const verdict = VERDICT[pulse.closeness];

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
        className="absolute inset-x-0 bottom-0 z-50 flex max-h-[82%] flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-950"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-zinc-700" />

        <header className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="leading-tight">
            <h2 className="text-[17px] font-semibold tracking-tight">
              Market pulse
            </h2>
            <p className="text-[11px] font-medium text-zinc-500">
              {asset.symbol}
              {market ? ` · ${windowLabel(market.windowSeconds)} window` : ""}
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

        <div className="no-scrollbar overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          {market === null ? (
            <Empty />
          ) : (
            <>
              {/* The read, in words. Everything below is the working. */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${verdict.tone}`}
                >
                  <Activity className="h-3 w-3" strokeWidth={2.6} />
                  {verdict.label}
                </span>
                <p className="mt-2 text-[14px] font-medium leading-snug text-zinc-200">
                  {pulse.sentence}
                </p>
              </div>

              <dl className="mt-3 space-y-px overflow-hidden rounded-2xl border border-zinc-800/80">
                <Row label="Distance from the line">
                  {pulse.distancePct === null ? (
                    <Pending />
                  ) : (
                    <span
                      className={`tnum font-semibold ${
                        pulse.leader === "up" ? "text-up-soft" : "text-down-soft"
                      }`}
                    >
                      {pulse.distancePct >= 0 ? "+" : "−"}
                      {formatPctValue(pulse.distancePct)}
                    </span>
                  )}
                </Row>

                <Row
                  label="Typical 1-minute move"
                  hint="Median move between oracle prints over the last hour"
                >
                  {pulse.typicalMovePct === null ? (
                    <Pending />
                  ) : (
                    <span className="tnum font-semibold text-zinc-300">
                      ±{formatPctValue(pulse.typicalMovePct)}
                    </span>
                  )}
                </Row>

                <Row label="Last 6 windows" hint="How each one actually settled">
                  {data.loading && data.recent.length === 0 ? (
                    <Pending />
                  ) : data.recent.length === 0 ? (
                    <span className="text-[12px] text-zinc-600">
                      none settled yet
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {data.recent.map((outcome, i) => (
                        <OutcomeChip key={i} outcome={outcome} />
                      ))}
                    </span>
                  )}
                </Row>

                <Row label="Resting book" hint="Orders a bet would cross now">
                  {data.loading ? (
                    <Pending />
                  ) : data.book === null ? (
                    <Unavailable />
                  ) : data.book.upOffers + data.book.downOffers === 0 ? (
                    <span className="text-[12px] text-zinc-600">empty</span>
                  ) : (
                    <span className="tnum text-[12px] font-semibold text-zinc-300">
                      <span className="text-up-soft">{data.book.upOffers} UP</span>
                      <span className="text-zinc-600"> · </span>
                      <span className="text-down-soft">
                        {data.book.downOffers} DOWN
                      </span>
                    </span>
                  )}
                </Row>

                <Row
                  label={
                    data.group?.scope === "group" ? "Your group" : "All players"
                  }
                  hint="Bets already placed in this window"
                >
                  {data.loading ? (
                    <Pending />
                  ) : data.group === null ? (
                    <Unavailable />
                  ) : data.group.up + data.group.down === 0 ? (
                    <span className="text-[12px] text-zinc-600">
                      nobody in yet
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-zinc-600" strokeWidth={2.4} />
                      <span className="tnum text-[12px] font-semibold">
                        <span className="text-up-soft">{data.group.up} UP</span>
                        <span className="text-zinc-600"> · </span>
                        <span className="text-down-soft">
                          {data.group.down} DOWN
                        </span>
                      </span>
                      <span className="tnum text-[11px] text-zinc-600">
                        {formatUsd(data.group.upStake + data.group.downStake)}{" "}
                        {NETWORK.collateral.symbol}
                      </span>
                    </span>
                  )}
                </Row>
              </dl>

              <p className="mt-3 px-1 text-[10px] leading-relaxed text-zinc-600">
                Every figure here is read from the contracts and the oracle — past
                windows are their settled verdicts, not guesses from the chart.
                None of it predicts the next one.
              </p>
            </>
          )}
        </div>
      </motion.section>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-900/40 px-4 py-3">
      <dt className="leading-tight">
        <span className="block text-[12px] font-medium text-zinc-400">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[10px] text-zinc-600">{hint}</span>
        )}
      </dt>
      <dd className="shrink-0 text-right text-[13px]">{children}</dd>
    </div>
  );
}

/** A value that has not arrived, which is never the same as a value of zero. */
function Pending() {
  return <span className="inline-block h-3.5 w-14 animate-pulse rounded bg-zinc-800" />;
}

/**
 * A value that is not coming — an unreadable book, or standings with no store
 * behind them. A skeleton that pulses forever reads as an app that is broken;
 * this says the row is empty and why, and lets the rest of the panel stand.
 */
function Unavailable() {
  return <span className="text-[12px] text-zinc-600">unavailable</span>;
}

function OutcomeChip({ outcome }: { outcome: WindowOutcome }) {
  if (outcome === "void") {
    return (
      <span
        title="void"
        className="grid h-5 w-5 place-items-center rounded-md bg-zinc-800 text-zinc-500"
      >
        <Minus className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }

  const up = outcome === "up";
  return (
    <span
      title={up ? "closed up" : "closed down"}
      className={`grid h-5 w-5 place-items-center rounded-md ${
        up ? "bg-up/20 text-up-soft" : "bg-down/20 text-down-soft"
      }`}
    >
      {up ? (
        <ArrowUp className="h-3 w-3" strokeWidth={3} />
      ) : (
        <ArrowDown className="h-3 w-3" strokeWidth={3} />
      )}
    </span>
  );
}

/** Nothing open means there is no window to have a pulse. */
function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
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
