"use client";

import Image from "next/image";
import { Wallet } from "lucide-react";
import { formatUsd, truncateAddress } from "@/lib/format";

interface TopBarProps {
  address: string;
  balance: number;
}

export function TopBar({ address, balance }: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2.5">
        {/* The mark carries its own violet/emerald glow, so it sits on a neutral
            chip rather than a coloured one that would fight it. */}
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900">
          <Image
            src="/logo-mark.png"
            alt=""
            width={512}
            height={512}
            priority
            className="h-7 w-7 object-contain"
          />
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold tracking-tight">DreamBet</h1>
          <p className="text-[11px] font-medium text-zinc-500">Somnia Network</p>
        </div>
      </div>

      {/* Mock wallet chip — replaced by the Privy embedded wallet in Step 3. */}
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/80 py-1.5 pl-3 pr-3.5 text-left transition-colors active:bg-zinc-800"
      >
        <Wallet className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={2.2} />
        <span className="leading-tight">
          <span className="tnum block text-[13px] font-semibold">
            {formatUsd(balance)}{" "}
            <span className="text-[11px] font-medium text-zinc-500">USDso</span>
          </span>
          <span className="tnum block font-mono text-[10px] text-zinc-500">
            {truncateAddress(address)}
          </span>
        </span>
      </button>
    </header>
  );
}
