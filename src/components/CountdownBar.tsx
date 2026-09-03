"use client";

import { Lock, Timer } from "lucide-react";
import type { EventWindow } from "@/hooks/useEventWindow";
import { WINDOW_MINUTES } from "@/hooks/useEventWindow";
import { formatDuration } from "@/lib/format";

/** Colour ramps from calm to urgent as the window drains. */
function urgency(secondsLeft: number, locked: boolean) {
  if (locked) return { bar: "bg-down", text: "text-down-soft" };
  if (secondsLeft < 60) return { bar: "bg-amber-400", text: "text-amber-300" };
  return { bar: "bg-violet-500", text: "text-zinc-300" };
}

export function CountdownBar({ window }: { window: EventWindow }) {
  const { ready, secondsLeft, progress, locked } = window;
  const tone = urgency(secondsLeft, locked);

  return (
    <section className="mx-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {locked ? (
            <Lock className="h-3.5 w-3.5" strokeWidth={2.4} />
          ) : (
            <Timer className="h-3.5 w-3.5" strokeWidth={2.4} />
          )}
          {WINDOW_MINUTES}m Event Window
        </span>

        {/* The clock is client-only: the server has no business guessing "now". */}
        {ready ? (
          <span className={`tnum text-[13px] font-semibold ${tone.text}`}>
            {locked ? (
              "Locked — settling"
            ) : (
              <>
                <span className="font-mono">{formatDuration(secondsLeft)}</span>
                <span className="ml-1.5 font-medium text-zinc-500">
                  left to predict
                </span>
              </>
            )}
          </span>
        ) : (
          <span className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
        )}
      </div>

      <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-linear ${tone.bar}`}
          style={{ width: ready ? `${(1 - progress) * 100}%` : "100%" }}
        />
      </div>
    </section>
  );
}
