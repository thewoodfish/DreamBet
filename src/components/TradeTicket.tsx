"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Loader2, X, Zap } from "lucide-react";
import { useDreamAccount } from "@/lib/account";
import { useStakeQuote } from "@/hooks/useStakeQuote";
import { NETWORK } from "@/lib/dreamdex/config";
import { ensureGas } from "@/lib/dreamdex/gas";
import {
  betErrorMessage,
  placeBet,
  NoSignerError,
  type BetFill,
} from "@/lib/dreamdex/trade";
import { haptic } from "@/lib/telegram";
import type { DreamdexMarket } from "@/lib/dreamdex/market";
import type { StakeQuote } from "@/lib/dreamdex/book";
import type { Asset } from "@/lib/assets";
import type { Direction } from "@/lib/round";
import { formatDuration, formatUsd, windowLabel } from "@/lib/format";

/** Sizes a punter reaches for without thinking. `Max` is whatever they hold. */
const QUICK_STAKES = [5, 10, 25] as const;

interface TradeTicketProps {
  asset: Asset;
  direction: Direction;
  /** The window being bet into — its pool is the book this order crosses. */
  market: DreamdexMarket;
  /** Collateral on hand, or null while it is still being read. */
  balance: number | null;
  secondsLeft: number;
  onClose: () => void;
  /** A confirmed fill: what was really bought, at what it really cost. */
  onPlaced: (fill: BetFill) => void;
}

/**
 * The two-tap execution. Tapping UP or DOWN arms a side; everything left to
 * decide is how much, so the sheet asks exactly one question and answers the
 * only one that comes back — what do I get if I'm right?
 *
 * That answer is quoted against the resting book for this specific size, not
 * taken from the window's headline odds, because a bet big enough to eat two
 * price levels does not get the price on the button.
 */
export function TradeTicket({
  asset,
  direction,
  market,
  balance,
  secondsLeft,
  onClose,
  onPlaced,
}: TradeTicketProps) {
  const account = useDreamAccount();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stake = Number.parseFloat(amount) || 0;
  const { quote, loading, unfillable, error: quoteError } = useStakeQuote(
    market.poolAddress,
    direction,
    stake,
    market.decimals
  );

  const isUp = direction === "up";
  const short = balance !== null && stake > balance;

  async function confirm() {
    if (!quote) return;
    setSubmitting(true);
    setError(null);
    // Heavier than arming a side, because this one spends money.
    haptic.press();

    try {
      const signer = await account.getSigner();
      if (!signer) throw new NoSignerError();

      // The sponsor tops up anyone who cannot pay for this order. Cheaper here
      // than as an error afterwards: a bet that fails for gas is a bet the
      // player thinks they placed.
      await ensureGas(signer.address);

      const fill = await placeBet({
        signer,
        pool: market.poolAddress,
        quote,
        decimals: market.decimals,
      });

      haptic.success();
      onPlaced(fill);
    } catch (cause) {
      haptic.failure();
      setError(betErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={submitting ? undefined : onClose}
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
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                isUp ? "bg-up/15 text-up-soft" : "bg-down/15 text-down-soft"
              }`}
            >
              {isUp ? (
                <ArrowUpRight className="h-5 w-5" strokeWidth={3} />
              ) : (
                <ArrowDownRight className="h-5 w-5" strokeWidth={3} />
              )}
            </span>
            <span className="leading-tight">
              <span className="block text-[17px] font-semibold tracking-tight">
                {asset.symbol} goes {isUp ? "UP" : "DOWN"}
              </span>
              {/* Which window, then how long is left in it. The venue rolls
                  cadences from a minute to an hour and the app takes whichever
                  is open, so the length is not something a player can assume —
                  and this is the last screen before their money is committed
                  to it. */}
              <span className="tnum block text-[11px] font-medium text-zinc-500">
                <span className="font-semibold text-zinc-300">
                  {windowLabel(market.windowSeconds)} window
                </span>
                {" · settles in "}
                {formatDuration(secondsLeft)}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-500 transition-colors active:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </header>

        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {/* The amount is the only thing left to decide, so it gets the size
              and the focus the price display gets on the screen behind. */}
          <label className="flex items-baseline justify-center gap-2">
            <span className="sr-only">Bet size in {NETWORK.collateral.symbol}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(sanitize(e.target.value))}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              className="tnum w-auto min-w-0 max-w-[62%] bg-transparent text-center text-[42px] font-bold tracking-tight text-white outline-none placeholder:text-zinc-700"
              size={Math.max(amount.length, 1)}
            />
            <span className="shrink-0 text-[15px] font-semibold text-zinc-500">
              {NETWORK.collateral.symbol}
            </span>
          </label>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {QUICK_STAKES.map((value) => (
              <QuickPill
                key={value}
                label={`${value}`}
                active={stake === value}
                onSelect={() => setAmount(`${value}`)}
              />
            ))}
            <QuickPill
              label="Max"
              active={balance !== null && stake === floor2(balance)}
              disabled={balance === null || balance <= 0}
              onSelect={() => balance !== null && setAmount(`${floor2(balance)}`)}
            />
          </div>

          {/* Pending only while an answer is still coming. Once the book has
              said there is no bet here, a pulsing skeleton would contradict the
              notice directly below it. */}
          <Breakdown
            quote={quote}
            pending={stake > 0 && !unfillable && !quoteError}
          />

          <Notices
            short={short}
            unfillable={unfillable && !loading}
            quoteError={quoteError}
            quote={quote}
            error={error}
          />

          <ConfirmButton
            signedIn={account.authenticated}
            walletReady={account.walletReady}
            previewOnly={account.isMock}
            onLogin={account.login}
            ready={quote !== null && !short}
            pricing={loading && quote === null}
            submitting={submitting}
            direction={direction}
            onConfirm={confirm}
          />
        </div>
      </motion.section>
    </>
  );
}

/**
 * What the bet returns, in the two numbers a punter actually weighs: everything
 * that comes back if they are right, and the profit inside it. "You pay" is the
 * order's real escrow rather than the typed amount — the book rounds a stake
 * down to a whole lot, and the difference is money that stays in the wallet.
 */
function Breakdown({
  quote,
  pending,
}: {
  quote: StakeQuote | null;
  /** An answer for the current amount is still on its way. */
  pending: boolean;
}) {
  return (
    <dl className="mt-4 space-y-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-card">
      <Row
        label="You pay"
        value={quote ? `${formatUsd(quote.cost)} ${NETWORK.collateral.symbol}` : null}
        pending={pending}
      />
      <Row
        label="Returns if right"
        value={quote ? `${formatUsd(quote.shares)} ${NETWORK.collateral.symbol}` : null}
        pending={pending}
        tone="text-up-soft"
      />
      <Row
        label="Profit"
        value={
          quote
            ? `+${formatUsd(quote.shares - quote.cost)}  ·  ${quote.payoutMultiplier.toFixed(2)}×`
            : null
        }
        pending={pending}
        tone="text-up-soft"
      />
    </dl>
  );
}

function Row({
  label,
  value,
  pending,
  tone = "text-zinc-100",
}: {
  label: string;
  value: string | null;
  /** Wait rather than showing a dash, because a number is still coming. */
  pending: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12px] font-medium text-zinc-500">{label}</dt>
      <dd className={`tnum text-[13px] font-semibold ${value ? tone : "text-zinc-600"}`}>
        {value ??
          (pending ? (
            <span className="inline-block h-3 w-16 animate-pulse rounded bg-zinc-800 align-middle" />
          ) : (
            "—"
          ))}
      </dd>
    </div>
  );
}

/**
 * Every reason a bet can't go through, stated before the button is tapped
 * rather than as a failure after it. They are ordered by what the user can do
 * about them: their own money first, then the market's, then ours.
 */
function Notices({
  short,
  unfillable,
  quoteError,
  quote,
  error,
}: {
  short: boolean;
  unfillable: boolean;
  quoteError: boolean;
  quote: StakeQuote | null;
  error: string | null;
}) {
  // A failed submission is the only one that describes something that already
  // happened, so it outranks the rest.
  if (error) return <Notice tone="down">{error}</Notice>;

  if (short) {
    return (
      <Notice tone="down">
        That&rsquo;s more {NETWORK.collateral.symbol} than you hold.
      </Notice>
    );
  }

  if (unfillable) {
    return (
      <Notice>
        Nobody is offering this side right now — there&rsquo;s nothing to bet
        against yet.
      </Notice>
    );
  }

  if (quoteError) {
    return <Notice>Couldn&rsquo;t read the book. Retrying…</Notice>;
  }

  // The book ran out before the stake did: the rest is simply not spent, and
  // saying so beats letting the user wonder why "you pay" is short.
  if (quote && quote.unfilled > 0.005) {
    return (
      <Notice>
        Only {formatUsd(quote.cost)} of that fits the book — the rest stays in
        your wallet.
      </Notice>
    );
  }

  return null;
}

function Notice({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "down";
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-3 rounded-lg px-3 py-2 text-center text-[11px] font-medium ${
        tone === "down" ? "bg-down/10 text-down-soft" : "bg-zinc-900 text-zinc-400"
      }`}
    >
      {children}
    </motion.p>
  );
}

function QuickPill({
  label,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic.select();
        onSelect();
      }}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      className={`tnum rounded-xl py-2 text-[13px] font-semibold transition-colors disabled:opacity-40 ${
        active
          ? "bg-zinc-100 text-zinc-950"
          : "bg-zinc-900 text-zinc-300 active:bg-zinc-800"
      }`}
    >
      {label}
    </motion.button>
  );
}

function ConfirmButton({
  signedIn,
  walletReady,
  previewOnly,
  onLogin,
  ready,
  pricing,
  submitting,
  direction,
  onConfirm,
}: {
  signedIn: boolean;
  /** The signer exists. Inside Telegram the login is seamless, so this lands a
      moment after `signedIn` does rather than together with it. */
  walletReady: boolean;
  /** No wallet layer is configured at all — there is nothing to sign with. */
  previewOnly: boolean;
  onLogin: () => void;
  /** There is a real quote and the user can afford it. */
  ready: boolean;
  /** Pricing the first quote for this amount — there is nothing to confirm yet. */
  pricing: boolean;
  submitting: boolean;
  direction: Direction;
  onConfirm: () => void;
}) {
  // Without Privy there is no signer, and offering "Confirm" would be offering
  // something that can only fail. The rest of the ticket still prices real
  // markets, which is the whole point of the preview.
  if (previewOnly) {
    return (
      <Button onClick={() => undefined} disabled tone="violet">
        Preview only — no wallet configured
      </Button>
    );
  }

  // Signing in is a different action with a different outcome, so it gets the
  // button rather than hiding behind a disabled one.
  if (!signedIn) {
    return (
      <Button onClick={onLogin} tone="violet">
        Log in to bet
      </Button>
    );
  }

  const disabled = !ready || submitting || pricing || !walletReady;

  return (
    <Button
      onClick={onConfirm}
      disabled={disabled}
      tone={direction === "up" ? "up" : "down"}
    >
      {submitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
          Placing your bet
        </>
      ) : !walletReady ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
          Connecting your wallet
        </>
      ) : pricing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
          Pricing
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 fill-current" strokeWidth={2.6} />
          Confirm Prediction
        </>
      )}
    </Button>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "up" | "down" | "violet";
}) {
  const fill = {
    up: "from-emerald-500 to-green-600 shadow-emerald-950/60",
    down: "from-rose-500 to-red-600 shadow-rose-950/60",
    violet: "from-violet-500 to-indigo-600 shadow-indigo-950/60",
  }[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b text-[15px] font-bold text-white shadow-lg transition-opacity disabled:opacity-40 ${fill}`}
    >
      {children}
    </motion.button>
  );
}

/** Digits and a single decimal point — a numeric keypad still emits the rest. */
function sanitize(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** Down to whole cents — never up, which would ask for more than is held. */
function floor2(value: number): number {
  return Math.floor(value * 100) / 100;
}
