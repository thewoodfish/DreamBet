"use client";

import { Lock, Timer } from "lucide-react";
import type { EventWindow } from "@/hooks/useEventWindow";
import { countdownTicks, formatDuration, windowLabel } from "@/lib/format";

/** Fallback tick count before a window is known, so the bar has a resting shape. */
const DEFAULT_SEGMENTS = 15;

/** Colour ramps from calm to urgent as the window drains. */
function urgency(secondsLeft: number, locked: boolean) {
  if (locked) {
    return {
      seg: "bg-down",
      digits: "text-down-soft",
      chip: "bg-down/15 text-down-soft",
      wash: "from-down/[0.12]",
    };
  }
  if (secondsLeft < 60) {
    return {
      seg: "bg-amber-400",
      digits: "text-amber-300",
      chip: "bg-amber-400/15 text-amber-300",
      wash: "from-amber-400/[0.10]",
    };
  }
  return {
    seg: "bg-violet-500",
    digits: "text-white",
    chip: "bg-violet-500/15 text-violet-300",
    wash: "from-violet-500/[0.08]",
  };
}

/**
 * The countdown is the thing that turns a price into a decision, so it's a
 * full-bleed ribbon pinned outside the scroll flow rather than a card inside
 * it — it must never be the element that scrolls away. Sitting between the
 * identity block and the trading half also lets it do the dividing.
 *
 * The bar is segmented one tick per minute: discrete enough to read "four
 * minutes left" at a glance, with the leading tick draining continuously so the
 * last seconds still feel live.
 */
export function CountdownBar({
  window,
  stalled = false,
}: {
  window: EventWindow;
  /** No window to count down to, and none coming imminently. */
  stalled?: boolean;
}) {
  const { ready, secondsLeft, progress, locked, windowSeconds } = window;
  const tone = urgency(secondsLeft, locked);
  // The fuse's tick count comes from the window's own length, so an hourly
  // window is not drawn as sixty hairlines and a one-minute one is not a single
  // undivided bar.
  const segments = ready
    ? countdownTicks(windowSeconds, DEFAULT_SEGMENTS)
    : DEFAULT_SEGMENTS;
  const remaining = (1 - progress) * segments;

  return (
    <section className="relative mt-3 border-y border-zinc-800/80 bg-zinc-900/30">
      {/* Urgency bleeds up behind the digits instead of only colouring them. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent transition-colors duration-500 ${tone.wash}`}
      />

      <div className="relative px-5 pb-2.5 pt-2">
        <div className="flex items-center justify-between">
          {/* Which window this is, in the words the share card uses. The app
              trades whichever cadence the venue has open, so this is the
              difference between a bet that settles in five minutes and one that
              settles in an hour — it cannot be left implied. Brighter than a
              label of this size would normally be, for the same reason. */}
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">
            {locked ? (
              <Lock className="h-3 w-3" strokeWidth={2.6} />
            ) : (
              <Timer className="h-3 w-3" strokeWidth={2.6} />
            )}
            {ready ? `${windowLabel(windowSeconds)} window` : "Event window"}
          </span>

          {ready ? (
            <span
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${tone.chip}`}
            >
              <span className="h-1 w-1 animate-pulse-ring rounded-full bg-current" />
              {locked ? "Settling" : "Open"}
            </span>
          ) : stalled ? (
            <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Paused
            </span>
          ) : (
            <span className="h-4 w-14 animate-pulse rounded bg-zinc-800" />
          )}
        </div>

        {/* The clock is client-only: the server has no business guessing "now". */}
        <div className="mt-1 flex items-baseline gap-2">
          {ready ? (
            <>
              <span
                className={`tnum font-mono text-[34px] font-bold leading-none tracking-tight transition-colors duration-300 ${tone.digits}`}
              >
                {formatDuration(secondsLeft)}
              </span>
              <span className="text-[11px] font-medium text-zinc-500">
                {locked ? "settling now" : "left to predict"}
              </span>
            </>
          ) : stalled ? (
            // A skeleton that never resolves reads as a broken app. This is a
            // waiting state, and it should look like one.
            <>
              <span className="tnum font-mono text-[34px] font-bold leading-none tracking-tight text-zinc-700">
                --:--
              </span>
              <span className="text-[11px] font-medium text-zinc-500">
                waiting for the next window
              </span>
            </>
          ) : (
            <span className="h-[34px] w-32 animate-pulse rounded-lg bg-zinc-800" />
          )}
        </div>
      </div>

      {/* The fuse. Sits flush on the band's edge so it reads as the boundary
          between "time to decide" and everything below it. */}
      <div className="relative flex gap-[3px] px-5 pb-2">
        {Array.from({ length: segments }, (_, i) => {
          // Segments drain right to left; only the leading one is partial.
          const fill = ready ? Math.min(Math.max(remaining - i, 0), 1) : stalled ? 0 : 1;
          return (
            <span
              key={i}
              className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-zinc-800"
            >
              <span
                className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-200 ease-linear ${tone.seg}`}
                style={{ width: `${fill * 100}%` }}
              />
            </span>
          );
        })}
      </div>
    </section>
  );
}
