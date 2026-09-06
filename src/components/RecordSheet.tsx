"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Flame, X } from "lucide-react";
import { AssetIcon } from "@/components/icons/AssetIcons";
import { LeaderboardList } from "@/components/LeaderboardList";
import type { HistoryEntry, UserStats } from "@/lib/round";
import type { LeaderboardScope } from "@/lib/leaderboard";
import { formatUsd } from "@/lib/format";

export type RecordTab = "record" | "leaderboard";

interface RecordSheetProps {
  stats: UserStats;
  history: HistoryEntry[];
  tab: RecordTab;
  onTabChange: (tab: RecordTab) => void;
  scope: LeaderboardScope;
  onScopeChange: (scope: LeaderboardScope) => void;
  groupAvailable?: boolean;
  /** Telegram's id for the launching chat — what "this group" is scoped to. */
  chatInstance?: string | null;
  /** The player, so the standings can find their row. */
  address?: string | null;
  onClose: () => void;
}

/**
 * Two views on the same question — how am I doing? The record is the receipts
 * behind your own streak; the leaderboard is the same thing measured against
 * everyone else in the chat.
 */
export function RecordSheet({
  stats,
  history,
  tab,
  onTabChange,
  scope,
  onScopeChange,
  groupAvailable,
  chatInstance,
  address,
  onClose,
}: RecordSheetProps) {
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
          <nav className="flex gap-4">
            {(["record", "leaderboard"] as RecordTab[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={`relative pb-1 text-[17px] font-semibold tracking-tight transition-colors ${
                  tab === key ? "text-white" : "text-zinc-600"
                }`}
              >
                {key === "record" ? "Your record" : "Leaderboard"}
                {tab === key && (
                  <motion.span
                    layoutId="record-tab"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-violet-500"
                  />
                )}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-500 transition-colors active:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {tab === "record" ? (
            <>
              <div className="grid shrink-0 grid-cols-3 gap-2">
                <Tile
                  label="Streak"
                  value={`${stats.streak}`}
                  icon={<Flame className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  tone="text-amber-300"
                />
                <Tile label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} />
                <Tile label="Best run" value={`${stats.bestStreak}`} />
              </div>

              <ul className="no-scrollbar mt-1 min-h-0 flex-1 overflow-y-auto">
                {history.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </>
          ) : (
            <LeaderboardList
              scope={scope}
              onScopeChange={onScopeChange}
              groupAvailable={groupAvailable}
              chatInstance={chatInstance}
              address={address}
            />
          )}
        </div>
      </motion.section>
    </>
  );
}

function Tile({
  label,
  value,
  icon,
  tone = "text-zinc-100",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 py-2.5 text-center">
      <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p
        className={`tnum mt-0.5 flex items-center justify-center gap-1 text-[17px] font-bold ${tone}`}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const isUp = entry.direction === "up";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="flex items-center gap-3 border-b border-zinc-900 py-3 last:border-0">
      <AssetIcon symbol={entry.symbol} className="h-8 w-8" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          {entry.symbol}
          <Icon
            className={`h-3.5 w-3.5 ${isUp ? "text-up-soft" : "text-down-soft"}`}
            strokeWidth={3}
          />
          <span className="tnum font-medium text-zinc-500">
            {formatUsd(entry.stake)}
          </span>
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-zinc-600">
          {entry.when}
        </span>
      </span>

      {/* A void returned the stake — neither a win nor a loss, and drawing it
          as a red zero would tell the player they lost a round nobody played. */}
      {entry.voided ? (
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          Void
        </span>
      ) : (
        <span
          className={`tnum shrink-0 text-[14px] font-bold ${
            entry.won ? "text-up-soft" : "text-zinc-600"
          }`}
        >
          {entry.net >= 0 ? "+" : "−"}
          {formatUsd(Math.abs(entry.net))}
        </span>
      )}
    </li>
  );
}
