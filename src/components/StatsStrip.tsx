"use client";

import { ChevronRight, Flame, Trophy } from "lucide-react";
import type { UserStats } from "@/lib/round";

interface StatsStripProps {
  stats: UserStats;
  onOpenRecord: () => void;
  onOpenLeaderboard: () => void;
}

/**
 * Slim identity row. Its job is to make the app feel like it knows who you are
 * the moment it opens, and to be the doorway to both your record and where you
 * stand against the group.
 */
export function StatsStrip({
  stats,
  onOpenRecord,
  onOpenLeaderboard,
}: StatsStripProps) {
  return (
    <div className="mx-5 flex items-center gap-1">
      <button
        type="button"
        onClick={onOpenRecord}
        className="flex flex-1 items-center gap-3 rounded-xl px-1 py-1.5 text-[12px] transition-colors active:bg-zinc-900"
      >
        <span className="flex items-center gap-1 font-semibold text-amber-400">
          <Flame className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="tnum">{stats.streak}</span>
          <span className="font-medium text-zinc-500">streak</span>
        </span>

        <span className="h-3 w-px bg-zinc-800" />

        <span className="font-medium text-zinc-500">
          <span className="tnum font-semibold text-zinc-300">
            {Math.round(stats.winRate * 100)}%
          </span>{" "}
          win rate
        </span>

        <span className="ml-auto flex items-center gap-0.5 font-medium text-zinc-500">
          <span className="tnum">{stats.rounds}</span> rounds
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenLeaderboard}
        aria-label="Leaderboard"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors active:bg-zinc-800"
      >
        <Trophy className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </div>
  );
}
