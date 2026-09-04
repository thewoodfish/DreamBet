"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, LogOut, Wallet, X } from "lucide-react";
import { useDreamAccount } from "@/lib/account";
import { NETWORK } from "@/lib/dreamdex/config";
import { haptic } from "@/lib/telegram";
import { formatUsd } from "@/lib/format";

interface AccountSheetProps {
  /** Collateral balance, or null while it is still being read. */
  balance: number | null;
  onClose: () => void;
}

/**
 * Everything about the wallet behind the Telegram identity, in one place.
 *
 * It exists mostly for one job: handing over the address. A player whose wallet
 * was created for them has no other way to reach it, and until they can copy it
 * they cannot put money in — so the address is the largest thing here, shown in
 * full rather than truncated, and selectable even if the copy button fails.
 */
export function AccountSheet({ balance, onClose }: AccountSheetProps) {
  const account = useDreamAccount();
  const [copied, setCopied] = useState(false);
  const address = account.address;

  async function copy() {
    if (!address) return;
    haptic.tap();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some webviews refuse clipboard writes. The address is rendered in full
      // and selectable precisely so this is a nuisance rather than a dead end.
    }
  }

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
        className="absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-950"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-zinc-700" />

        <header className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-zinc-400">
              <Wallet className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block text-[17px] font-semibold tracking-tight">
                Your wallet
              </span>
              <span className="block text-[11px] font-medium text-zinc-500">
                {account.username ? `@${account.username} · ` : ""}
                {NETWORK.chain.name}
              </span>
            </span>
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

        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Balance
          </p>
          <p className="tnum mt-0.5 text-[28px] font-bold leading-none tracking-tight">
            {balance === null ? (
              <span className="inline-block h-6 w-24 animate-pulse rounded bg-zinc-900 align-middle" />
            ) : (
              formatUsd(balance)
            )}{" "}
            <span className="text-[13px] font-semibold text-zinc-500">
              {NETWORK.collateral.symbol}
            </span>
          </p>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Address
          </p>
          {/* Full, wrapped and selectable. Truncating here would defeat the
              only reason most people open this sheet. */}
          <p className="mt-1.5 select-all break-all rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 font-mono text-[12px] leading-relaxed text-zinc-300">
            {address ?? "—"}
          </p>

          <motion.button
            type="button"
            onClick={copy}
            disabled={!address}
            whileTap={address ? { scale: 0.97 } : undefined}
            className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 text-[14px] font-bold text-zinc-950 transition-opacity disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={3} />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" strokeWidth={2.6} />
                Copy address
              </>
            )}
          </motion.button>

          <p className="mt-2.5 text-center text-[11px] font-medium leading-relaxed text-zinc-500">
            Send {NETWORK.collateral.symbol} to bet with, and{" "}
            {NETWORK.chain.nativeCurrency.symbol} for gas, to this address.
          </p>

          {/* Deliberately last, quiet, and its own tap. It used to be what the
              top bar did when you touched it, which meant the likeliest tap in
              the app ended the session. */}
          {!account.isMock && (
            <button
              type="button"
              onClick={() => {
                account.logout();
                onClose();
              }}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold text-zinc-600 transition-colors active:text-down-soft"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.4} />
              Log out
            </button>
          )}
        </div>
      </motion.section>
    </>
  );
}
