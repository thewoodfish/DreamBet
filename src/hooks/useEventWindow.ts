"use client";

import { useEffect, useState } from "react";
import type { DreamdexMarket } from "@/lib/dreamdex/market";

/**
 * A window stops being worth offering shortly before it expires: a tap that
 * lands after the book closes is a bet the user never got to make. Matches the
 * cutoff `pickTradableMarket` applies when choosing the window.
 */
const LOCK_SECONDS = 5;

export interface EventWindow {
  /** False until a market is loaded and the client clock has ticked. */
  ready: boolean;
  /** Seconds until this window stops trading. */
  secondsLeft: number;
  /** 0 → window just opened, 1 → expiring. */
  progress: number;
  /** Inside the final seconds: the window no longer accepts orders. */
  locked: boolean;
  /** Window length in seconds, as the contract defines it. */
  windowSeconds: number;
  /** Wall-clock ms the window expires at, or null before a market is known. */
  expiresAt: number | null;
}

const IDLE: EventWindow = {
  ready: false,
  secondsLeft: 0,
  progress: 0,
  locked: false,
  windowSeconds: 0,
  expiresAt: null,
};

/**
 * Countdown to the close of the event contract's own window.
 *
 * The timing is the contract's, not this app's: `tradingStart` and `expiry`
 * come off the market, so every player in a Telegram group is watching the same
 * clock as the venue rather than a wall-clock window that merely resembles it.
 */
export function useEventWindow(market: DreamdexMarket | null): EventWindow {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (now === null || market === null) return IDLE;

  const nowSec = now / 1000;
  const secondsLeft = Math.max(market.expiry - nowSec, 0);
  const elapsed = nowSec - market.tradingStart;
  const windowSeconds = market.windowSeconds || 1;

  return {
    ready: true,
    secondsLeft,
    progress: Math.min(Math.max(elapsed / windowSeconds, 0), 1),
    locked: secondsLeft <= LOCK_SECONDS,
    windowSeconds: market.windowSeconds,
    expiresAt: market.expiry * 1000,
  };
}
