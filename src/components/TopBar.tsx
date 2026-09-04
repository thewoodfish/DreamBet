"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Send, Wallet } from "lucide-react";
import { useDreamAccount } from "@/lib/account";
import { NETWORK } from "@/lib/dreamdex/config";
import { avatarTint, initials } from "@/lib/leaderboard";
import { formatUsd, truncateAddress } from "@/lib/format";

interface TopBarProps {
  /** Collateral balance. Null while it is still being read. */
  balance: number | null;
  /** Shown when there is no wallet layer configured, so the UI stays previewable. */
  fallbackAddress: string;
  /** Opens the wallet sheet — address, funding and, deliberately, logging out. */
  onOpenAccount: () => void;
}

export function TopBar({ balance, fallbackAddress, onOpenAccount }: TopBarProps) {
  const account = useDreamAccount();

  // Without Privy configured there is nothing to log into, so the mock account
  // keeps its old always-connected look rather than showing a dead button.
  const connected = account.isMock || account.authenticated;
  const address = account.address ?? fallbackAddress;

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
          <p className="text-[11px] font-medium text-zinc-500">
            {NETWORK.chain.name}
          </p>
        </div>
      </div>

      {!account.ready ? (
        <span className="h-[42px] w-[132px] animate-pulse rounded-2xl bg-zinc-900" />
      ) : connected ? (
        /* Opens the wallet, rather than closing the session. A player whose
           wallet was made for them has no other route to their own address, so
           this is the tap that lets them fund it — logging out moved inside,
           where it has to be chosen. */
        <motion.button
          type="button"
          onClick={onOpenAccount}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-900/40 py-1.5 pl-1.5 pr-3 text-left shadow-card transition-colors active:border-zinc-700"
        >
          {/* The same tint this address wears on the leaderboard, so "me" looks
              the same everywhere in the app. */}
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white/95 ring-1 ring-inset ring-white/15 ${avatarTint(
              address
            )}`}
          >
            {account.username ? (
              initials(account.username)
            ) : (
              <Wallet className="h-3.5 w-3.5" strokeWidth={2.6} />
            )}
          </span>

          <span className="leading-tight">
            <span className="flex items-baseline gap-1">
              <span className="tnum text-[14px] font-bold tracking-tight text-white">
                {balance === null ? (
                  <span className="inline-block h-3.5 w-11 animate-pulse rounded bg-zinc-800 align-middle" />
                ) : (
                  formatUsd(balance)
                )}
              </span>
              <span className="text-[10px] font-semibold text-zinc-500">
                {NETWORK.collateral.symbol}
              </span>
            </span>
            <span className="tnum mt-0.5 block font-mono text-[10px] leading-none text-zinc-600">
              {truncateAddress(address, 5, 4)}
            </span>
          </span>
        </motion.button>
      ) : (
        /* Step 3's onboarding: one tap, no seed phrase — Privy spins the
           embedded EVM wallet up behind the Telegram identity. */
        <motion.button
          type="button"
          onClick={account.login}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 py-2.5 pl-3.5 pr-4 text-[13px] font-bold text-white shadow-lg shadow-indigo-950/60"
        >
          <Send className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Log in
        </motion.button>
      )}
    </header>
  );
}
