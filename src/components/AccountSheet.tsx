"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Fuel, LogOut, Wallet, X } from "lucide-react";
import { useDreamAccount } from "@/lib/account";
import { NETWORK } from "@/lib/dreamdex/config";
import { avatarTint, initials } from "@/lib/leaderboard";
import { haptic } from "@/lib/telegram";
import { formatUsd } from "@/lib/format";

interface AccountSheetProps {
  /** Collateral balance, or null while it is still being read. */
  balance: number | null;
  /** Stand-in shown when no wallet layer is configured — the same one the top
      bar displays, so the two never disagree about who you are. */
  fallbackAddress: string;
  onClose: () => void;
}

/**
 * Everything about the wallet behind the Telegram identity, in one place.
 *
 * It exists mostly for one job: getting money in. A player whose wallet was
 * created for them has no other route to its address, so the two ways of moving
 * one between devices — scanning it and copying it — are the whole top half of
 * the sheet, and everything else sits underneath.
 */
export function AccountSheet({
  balance,
  fallbackAddress,
  onClose,
}: AccountSheetProps) {
  const account = useDreamAccount();
  const [copied, setCopied] = useState(false);
  const address = account.address ?? (account.isMock ? fallbackAddress : null);

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
        className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm"
      />

      <motion.section
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="absolute inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col overflow-hidden rounded-t-3xl border-t border-zinc-800 bg-zinc-950"
      >
        {/* A wash behind the header, so the sheet reads as its own surface
            rather than a panel that happens to be dark. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl"
        />

        <div className="relative mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-zinc-700" />

        <header className="relative flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[12px] font-bold text-white/95 ring-1 ring-inset ring-white/15 ${avatarTint(
                address ?? "dreambet"
              )}`}
            >
              {account.username ? (
                initials(account.username)
              ) : (
                <Wallet className="h-4 w-4" strokeWidth={2.6} />
              )}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[17px] font-semibold tracking-tight">
                {account.username ? `@${account.username}` : "Your wallet"}
              </span>
              <span className="block text-[11px] font-medium text-zinc-500">
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

        <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {/* The QR sits on white by deliberate exception to the dark theme:
              scanners want maximum contrast, and a tinted or inverted code is
              the kind of styling that looks better and works worse. */}
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-3 shadow-lg shadow-black/40">
              {address ? (
                <QRCodeSVG
                  value={address}
                  size={148}
                  level="M"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                  title="Wallet address"
                />
              ) : (
                <span className="block h-[148px] w-[148px] animate-pulse rounded bg-zinc-200" />
              )}
            </div>
          </div>

          {/* Full, wrapped and selectable. Truncating here would defeat the
              only reason most people open this sheet. */}
          <p className="mt-4 select-all break-all rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-3.5 py-3 text-center font-mono text-[12px] leading-relaxed text-zinc-300 shadow-card">
            {address ?? "—"}
          </p>

          <motion.button
            type="button"
            onClick={copy}
            disabled={!address}
            whileTap={address ? { scale: 0.97 } : undefined}
            className={`mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold transition-colors disabled:opacity-40 ${
              copied
                ? "bg-up/15 text-up-soft"
                : "bg-zinc-100 text-zinc-950 active:bg-white"
            }`}
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

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-900 pt-4">
            <span className="text-[12px] font-medium text-zinc-500">Balance</span>
            <span className="tnum text-[20px] font-bold tracking-tight">
              {balance === null ? (
                <span className="inline-block h-5 w-20 animate-pulse rounded bg-zinc-900 align-middle" />
              ) : (
                formatUsd(balance)
              )}{" "}
              <span className="text-[12px] font-semibold text-zinc-500">
                {NETWORK.collateral.symbol}
              </span>
            </span>
          </div>

          {/* Two different tokens do two different jobs here, and only one of
              them is obvious — a funded balance with no gas still cannot bet. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <FundingHint
              token={NETWORK.collateral.symbol}
              purpose="to bet with"
              icon={<Wallet className="h-3.5 w-3.5" strokeWidth={2.4} />}
            />
            <FundingHint
              token={NETWORK.chain.nativeCurrency.symbol}
              purpose="for gas"
              icon={<Fuel className="h-3.5 w-3.5" strokeWidth={2.4} />}
            />
          </div>

          {/* Deliberately last, quiet, and its own tap. It used to be what the
              top bar did when you touched it, which meant the likeliest tap in
              the app ended the session. */}
          {account.authenticated && (
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

function FundingHint({
  token,
  purpose,
  icon,
}: {
  token: string;
  purpose: string;
  icon: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2">
      <span className="shrink-0 text-zinc-600">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12px] font-bold">{token}</span>
        <span className="block truncate text-[10px] font-medium text-zinc-500">
          {purpose}
        </span>
      </span>
    </span>
  );
}
