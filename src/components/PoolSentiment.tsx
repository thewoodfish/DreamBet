"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import type { PoolSnapshot } from "@/lib/assets";
import { formatUsd } from "@/lib/format";

export function PoolSentiment({ pool }: { pool: PoolSnapshot }) {
  const upPct = Math.round(pool.upShare * 100);

  return (
    <div className="mx-5">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
        <span className="tnum text-up-soft">{upPct}% UP</span>
        <span className="flex items-center gap-1 font-medium text-zinc-500">
          <Users className="h-3 w-3" strokeWidth={2.4} />
          <span className="tnum">{formatUsd(pool.totalStaked)}</span> USDso pooled
        </span>
        <span className="tnum text-down-soft">{100 - upPct}% DOWN</span>
      </div>

      {/* One track, split by an absolutely positioned UP fill: keeps the two
          sides exactly complementary instead of letting flex resolve widths. */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-down/70">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-up"
          initial={false}
          animate={{ width: `${upPct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}
