"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Check, Link2, Megaphone, X } from "lucide-react";
import { AssetIcon } from "@/components/icons/AssetIcons";
import { NETWORK } from "@/lib/dreamdex/config";
import {
  betText,
  challengeUrl,
  resultText,
  type Challenge,
} from "@/lib/challenge";
import { haptic, shareToChat, type ShareOutcome } from "@/lib/telegram";
import type { Asset } from "@/lib/assets";
import type { Direction } from "@/lib/round";
import { formatUsd, windowLabel } from "@/lib/format";

/** What is being shared — a bet just placed, or a window already decided. */
export type ShareSubject =
  /** `windowSeconds` is the window the bet actually went into — the app trades
      whichever cadence is open, so the card cannot assume one. */
  | {
      kind: "bet";
      direction: Direction;
      stake: number;
      multiplier: number;
      windowSeconds: number;
    }
  | {
      kind: "result";
      direction: Direction;
      net: number;
      won: boolean;
      voided: boolean;
      windowSeconds: number;
    };

interface ShareSheetProps {
  asset: Asset;
  subject: ShareSubject;
  /** Telegram handle to sign the card with, without the @. */
  username: string | null;
  onClose: () => void;
}

/**
 * The viral moment. A bet that stays on one phone is worth nothing to this
 * product, so the instant one is placed it is rendered as something worth
 * sending — and the send is a challenge, not an announcement: the link names
 * the side taken so the group is invited to oppose it.
 */
export function ShareSheet({ asset, subject, username, onClose }: ShareSheetProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [sharing, setSharing] = useState(false);

  const isUp = subject.direction === "up";
  const challenge: Challenge = {
    from: username,
    symbol: asset.symbol,
    direction: subject.direction,
  };

  async function share() {
    setSharing(true);
    haptic.press();

    const text =
      subject.kind === "bet"
        ? betText(
            challenge,
            formatUsd(subject.stake),
            NETWORK.collateral.symbol,
            windowLabel(subject.windowSeconds)
          )
        : resultText(
            challenge,
            formatUsd(Math.abs(subject.net)),
            subject.won,
            subject.voided,
            NETWORK.collateral.symbol,
            windowLabel(subject.windowSeconds)
          );

    setOutcome(await shareToChat(challengeUrl(challenge), text));
    setSharing(false);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md"
      />

      {/* Centred by flex rather than by a translate utility: the section
          animates its own `y`, and Framer's inline transform would overwrite a
          `-translate-y-1/2` class outright. */}
      <div className="pointer-events-none absolute inset-0 z-[70] flex items-center px-5">
      <motion.section
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="pointer-events-auto relative w-full"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-11 right-0 grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-500 transition-colors active:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <TradingCard
          asset={asset}
          subject={subject}
          username={username}
          isUp={isUp}
        />

        <motion.button
          type="button"
          onClick={share}
          disabled={sharing}
          whileTap={sharing ? undefined : { scale: 0.97 }}
          className="mt-3.5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-[16px] font-bold text-white shadow-lg shadow-indigo-950/60 disabled:opacity-60"
        >
          <Megaphone className="h-5 w-5" strokeWidth={2.5} />
          Challenge Friends in Group
        </motion.button>

        {/* Only the endings the user can't see for themselves are worth saying:
            the native picker is its own confirmation, a clipboard copy is not. */}
        {outcome === "copied" && (
          <Feedback icon={<Link2 className="h-3.5 w-3.5" strokeWidth={2.6} />}>
            Challenge link copied — paste it into the chat
          </Feedback>
        )}
        {outcome === "shared" && (
          <Feedback icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />}>
            Challenge sent
          </Feedback>
        )}
        {outcome === "failed" && (
          <Feedback>Couldn&rsquo;t open a way to share on this device</Feedback>
        )}
      </motion.section>
      </div>
    </>
  );
}

/**
 * The card itself, built to survive a screenshot: everything that makes the
 * claim — who, what, how much, and on what — is inside one frame, because that
 * frame is what gets forwarded.
 */
function TradingCard({
  asset,
  subject,
  username,
  isUp,
}: {
  asset: Asset;
  subject: ShareSubject;
  username: string | null;
  isUp: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 ${
        isUp ? "border-up/30 bg-up-deep/40" : "border-down/30 bg-down-deep/40"
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
          isUp ? "bg-up/25" : "bg-down/25"
        }`}
      />

      <header className="relative flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Image
            src="/logo-mark.png"
            alt=""
            width={512}
            height={512}
            className="h-6 w-6 object-contain"
          />
          <span className="text-[13px] font-bold tracking-tight">DreamBet</span>
        </span>
        <span className="text-[11px] font-semibold text-zinc-500">
          {asset.pair}
        </span>
      </header>

      <div className="relative mt-5 flex items-center gap-3">
        <AssetIcon symbol={asset.symbol} className="h-11 w-11" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {subject.kind === "bet" ? "Called it" : "Result"}
          </p>
          <p className="flex items-center gap-1.5 text-[22px] font-bold leading-tight tracking-tight">
            {asset.symbol} {isUp ? "UP" : "DOWN"}
            {isUp ? (
              <ArrowUpRight className="h-5 w-5 text-up-soft" strokeWidth={3} />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-down-soft" strokeWidth={3} />
            )}
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-3">
        {subject.kind === "bet" ? (
          <>
            <Stat label="Stake" value={`${formatUsd(subject.stake)} ${NETWORK.collateral.symbol}`} />
            <Stat
              label="To win"
              value={`${subject.multiplier.toFixed(2)}×`}
              tone={isUp ? "text-up-soft" : "text-down-soft"}
            />
          </>
        ) : (
          <>
            <Stat
              label={subject.voided ? "Voided" : subject.won ? "Won" : "Lost"}
              value={`${subject.net >= 0 ? "+" : "−"}${formatUsd(Math.abs(subject.net))} ${NETWORK.collateral.symbol}`}
              tone={subject.won && !subject.voided ? "text-up-soft" : "text-zinc-400"}
            />
            <Stat label="Window" value={windowLabel(subject.windowSeconds)} />
          </>
        )}
      </div>

      <footer className="relative mt-5 flex items-center justify-between border-t border-white/5 pt-3.5">
        <span className="text-[12px] font-semibold text-zinc-300">
          {username ? `@${username}` : "A DreamBet player"}
        </span>
        <span className="text-[11px] font-bold tracking-tight text-violet-400">
          #DreamBet
        </span>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="leading-tight">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className={`tnum block text-[17px] font-bold ${tone}`}>{value}</span>
    </span>
  );
}

function Feedback({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-400"
    >
      {icon}
      {children}
    </motion.p>
  );
}
