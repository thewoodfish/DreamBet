"use client";

import { useEffect, useState } from "react";
import {
  HISTORY_LENGTH,
  nextPrice,
  seedHistory,
  type Asset,
} from "@/lib/assets";

/** How often the mock feed ticks. Replaced by the Somnia oracle in Step 4. */
const TICK_MS = 1_200;
/** How long the price stays tinted after a tick before settling back to white. */
const FLASH_MS = 420;

export interface PriceFeed {
  /** Latest price. */
  price: number;
  /** Rolling window of the last hour, oldest first. */
  history: number[];
  /** Percentage move across the visible window. */
  changePct: number;
  /**
   * Direction of the most recent tick, cleared shortly after. This is a
   * transient flash only — the resting colour is white, so it never contradicts
   * the window's overall change badge.
   */
  flash: "up" | "down" | null;
}

interface Tick {
  direction: "up" | "down" | null;
  /** Bumped on every tick so repeated moves in the same direction re-flash. */
  id: number;
}

/**
 * Simulated live price feed. The opening history is seeded deterministically
 * (see `seedHistory`) so the server and client agree on first paint; the random
 * walk only starts once we're mounted in the browser.
 */
export function usePriceFeed(asset: Asset): PriceFeed {
  const [history, setHistory] = useState<number[]>(() => seedHistory(asset));
  const [tick, setTick] = useState<Tick>({ direction: null, id: 0 });

  useEffect(() => {
    setHistory(seedHistory(asset));
    setTick({ direction: null, id: 0 });

    const id = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        const next = nextPrice(asset, last);
        setTick((t) => ({
          direction: next > last ? "up" : next < last ? "down" : null,
          id: t.id + 1,
        }));
        return [...prev.slice(-(HISTORY_LENGTH - 1)), next];
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [asset]);

  // Clear the tint a beat after each tick. Keyed on `id` so back-to-back moves
  // in the same direction each get their own full flash.
  useEffect(() => {
    if (tick.direction === null) return;
    const timer = setTimeout(
      () => setTick((t) => (t.id === tick.id ? { ...t, direction: null } : t)),
      FLASH_MS
    );
    return () => clearTimeout(timer);
  }, [tick.id, tick.direction]);

  const price = history[history.length - 1];
  const open = history[0];
  const changePct = open === 0 ? 0 : ((price - open) / open) * 100;

  return { price, history, changePct, flash: tick.direction };
}
