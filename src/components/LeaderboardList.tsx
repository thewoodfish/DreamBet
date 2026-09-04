"use client";

import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import {
  MOCK_LEADERBOARD,
  SCOPE_LABELS,
  avatarTint,
  initials,
  type LeaderboardEntry,
  type LeaderboardScope,
} from "@/lib/leaderboard";
import { formatUsd } from "@/lib/format";

interface LeaderboardListProps {
  scope: LeaderboardScope;
  onScopeChange: (scope: LeaderboardScope) => void;
  /** False when the app wasn't launched from a group chat, so there is no
      chat_instance to scope by and "This group" can't be offered. */
  groupAvailable?: boolean;
  /** Telegram's id for the chat this was launched from — what "this group"
      means. */
  chatInstance?: string | null;
  /** The player, so their own row can be found and pinned. */
  address?: string | null;
}

export function LeaderboardList({
  scope,
  onScopeChange,
  groupAvailable = true,
  chatInstance = null,
  address = null,
}: LeaderboardListProps) {
  const board = useLeaderboard(scope, chatInstance, address);

  // Real standings whenever there is a store to hold them. The mocks stay for
  // the preview build, where an empty table would read as a broken screen
  // rather than as an app nobody has bet in yet.
  const rows = board.unavailable ? MOCK_LEADERBOARD[scope] : board.rows;
  const top = rows.filter((r) => !r.isYou);
  const you = rows.find((r) => r.isYou);

  return (
    <>
      <div className="flex shrink-0 gap-1 rounded-xl bg-zinc-900 p-1">
        {(Object.keys(SCOPE_LABELS) as LeaderboardScope[]).map((key) => {
          const disabled = key === "group" && !groupAvailable;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onScopeChange(key)}
              className={`relative flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-30 ${
                scope === key ? "text-white" : "text-zinc-500"
              }`}
            >
              {scope === key && (
                <motion.span
                  layoutId="scope-pill"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="absolute inset-0 rounded-lg bg-zinc-800"
                />
              )}
              <span className="relative z-10">{SCOPE_LABELS[key]}</span>
            </button>
          );
        })}
      </div>

      {board.loading && !board.unavailable && rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center gap-2 text-[12px] font-medium text-zinc-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} />
          Reading the standings
        </p>
      ) : rows.length === 0 ? (
        // A settled bet is what puts somebody on this table, so an empty one
        // says which of the two is missing rather than just "no data".
        <p className="flex flex-1 items-center justify-center px-6 text-center text-[12px] font-medium leading-relaxed text-zinc-600">
          {scope === "group"
            ? "Nobody in this chat has had a bet settle yet. Be the first."
            : "No bets have settled yet. Yours could be the first."}
        </p>
      ) : (
        <ul className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto">
          {top.map((entry) => (
            <Row key={entry.address} entry={entry} />
          ))}
        </ul>
      )}

      {/* Pinned so you always see where you stand, however far down you are. */}
      {you && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 pt-1">
          <Row entry={you} />
        </div>
      )}
    </>
  );
}

const MEDALS: Record<number, string> = {
  1: "text-amber-300",
  2: "text-zinc-300",
  3: "text-orange-400",
};

function Row({ entry }: { entry: LeaderboardEntry }) {
  const positive = entry.netPnl >= 0;

  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${
        entry.isYou ? "bg-violet-500/10 ring-1 ring-violet-500/30" : ""
      }`}
    >
      <span
        className={`tnum w-7 shrink-0 text-center text-[13px] font-bold ${
          MEDALS[entry.rank] ?? "text-zinc-600"
        }`}
      >
        {entry.rank}
      </span>

      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-black/80 ${avatarTint(
          entry.address
        )}`}
      >
        {initials(entry.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
          {entry.isYou ? "You" : entry.name}
          {entry.streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
              <Flame className="h-3 w-3" strokeWidth={2.6} />
              {entry.streak}
            </span>
          )}
        </span>
        <span className="tnum mt-0.5 block text-[11px] font-medium text-zinc-600">
          {Math.round(entry.winRate * 100)}% win rate
        </span>
      </span>

      <span
        className={`tnum shrink-0 text-[14px] font-bold ${
          positive ? "text-up-soft" : "text-down-soft"
        }`}
      >
        {positive ? "+" : "−"}
        {formatUsd(Math.abs(entry.netPnl))}
      </span>
    </li>
  );
}
