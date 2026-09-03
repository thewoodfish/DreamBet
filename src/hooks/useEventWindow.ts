"use client";

import { useEffect, useState } from "react";

/** dreamDEX event contracts settle on a fixed cadence. */
export const WINDOW_MINUTES = 15;
export const WINDOW_MS = WINDOW_MINUTES * 60 * 1000;

/** Predictions lock shortly before settlement. */
const LOCK_SECONDS = 30;

export interface EventWindow {
  /** False until the first client tick, so the server never renders a clock. */
  ready: boolean;
  secondsLeft: number;
  /** 0 → window just opened, 1 → about to settle. */
  progress: number;
  /**
   * Within the final seconds the current window stops accepting positions.
   * Bets don't stop — they retarget to the next window (see `bettableWindow`).
   */
  locked: boolean;
  /** Index of the current wall-clock window. Changes = the previous one settled. */
  windowIndex: number;
  /** Window a new position would land in: the next one once we're locked. */
  bettableWindow: number;
  /** Wall-clock ms at which `bettableWindow` closes and settles. */
  bettableSettleAt: number;
}

/** Wall-clock ms at which the given window index closes. */
export function windowSettleAt(windowIndex: number): number {
  return (windowIndex + 1) * WINDOW_MS;
}

/**
 * Countdown to the end of the current wall-clock-aligned event window, so every
 * player in a Telegram group sees the same timer without any shared state.
 */
export function useEventWindow(): EventWindow {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return {
      ready: false,
      secondsLeft: 0,
      progress: 0,
      locked: false,
      windowIndex: 0,
      bettableWindow: 0,
      bettableSettleAt: 0,
    };
  }

  const elapsed = now % WINDOW_MS;
  const msLeft = WINDOW_MS - elapsed;
  const secondsLeft = msLeft / 1000;
  const windowIndex = Math.floor(now / WINDOW_MS);
  const locked = secondsLeft <= LOCK_SECONDS;
  const bettableWindow = locked ? windowIndex + 1 : windowIndex;

  return {
    ready: true,
    secondsLeft,
    progress: elapsed / WINDOW_MS,
    locked,
    windowIndex,
    bettableWindow,
    bettableSettleAt: windowSettleAt(bettableWindow),
  };
}
