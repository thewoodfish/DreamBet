"use client";

import { isTradableAsset } from "@/lib/dreamdex/config";
import type { AssetSymbol } from "@/lib/assets";
import type { Direction, Position } from "@/lib/round";

/**
 * The open bet, remembered across launches.
 *
 * Without this the result of a bet is only ever seen by somebody who happens to
 * still be looking. A position lived in React state alone, so closing the Mini
 * App — which is what people do while they wait out fifteen minutes or an hour —
 * threw away the one moment the whole product is built around. The bet settled
 * on-chain regardless and scored on the leaderboard; the player just never found
 * out. This is what lets the app say "you won" the next time it is opened.
 *
 * Deliberately only the open position: one record, replaced by the next bet and
 * cleared once its result has been seen. History belongs to the chain and the
 * standings, not to a browser store nobody can audit.
 */

const KEY = "dreambet.position.v1";

/**
 * How long a remembered bet is still worth showing. Long enough to cover a
 * night's sleep on an hourly window, short enough that a result nobody came
 * back for does not ambush them a week later.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface StoredPosition {
  position: Position;
  /** Which pill this was bet on — a position alone does not say. */
  symbol: AssetSymbol;
  /** Unix ms the window closes, so a stale record can be aged out. */
  expiresAt: number;
  /** When it was written. */
  placedAt: number;
}

/** Remember this bet, replacing whatever was there. Never throws. */
export function rememberPosition(record: StoredPosition): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Private mode, blocked storage, a full quota. The bet is already on-chain;
    // forgetting it costs the player a replay, not their money.
  }
}

/** Drop the remembered bet — its result has been seen, or a new one replaced it. */
export function forgetPosition(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; a stale record ages out on its own.
  }
}

/**
 * The remembered bet, if there is one worth restoring.
 *
 * Everything is checked rather than trusted. This is local storage: it can be
 * edited by hand, left behind by an older version of the app, or written by
 * something else entirely on a shared origin. A malformed record must read as
 * "no open bet" and never as a position with a plausible-looking payout, so
 * every field is verified and anything unexpected is discarded outright.
 */
export function recallPosition(now = Date.now()): StoredPosition | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    const record = asRecord(parsed);
    if (!record) {
      forgetPosition();
      return null;
    }

    // A bet old enough to have been forgotten by its owner too.
    if (now - record.placedAt > MAX_AGE_MS) {
      forgetPosition();
      return null;
    }

    return record;
  } catch {
    forgetPosition();
    return null;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isHexAddress(v: unknown): v is `0x${string}` {
  return typeof v === "string" && /^0x[0-9a-fA-F]{1,128}$/.test(v);
}

function isDirection(v: unknown): v is Direction {
  return v === "up" || v === "down";
}

/** Structural check over every field the overlay and the share card will read. */
function asRecord(value: unknown): StoredPosition | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  if (typeof r.symbol !== "string" || !isTradableAsset(r.symbol)) return null;
  if (!isFiniteNumber(r.expiresAt) || !isFiniteNumber(r.placedAt)) return null;

  const p = r.position;
  if (typeof p !== "object" || p === null) return null;
  const q = p as Record<string, unknown>;

  if (!isDirection(q.direction)) return null;
  if (!isHexAddress(q.marketId)) return null;
  // A stake or a strike that is zero or negative would render as a real bet
  // with nonsense in it; a payout multiplier below 1 would promise a loss on a
  // win. None of those can come from a bet this app actually placed.
  if (!isFiniteNumber(q.stake) || q.stake <= 0) return null;
  if (!isFiniteNumber(q.strike) || q.strike <= 0) return null;
  if (!isFiniteNumber(q.entryPrice) || q.entryPrice <= 0) return null;
  if (!isFiniteNumber(q.payoutMultiplier) || q.payoutMultiplier < 1) return null;
  if (!isFiniteNumber(q.windowSeconds) || q.windowSeconds <= 0) return null;

  return {
    symbol: r.symbol,
    expiresAt: r.expiresAt,
    placedAt: r.placedAt,
    position: {
      direction: q.direction,
      stake: q.stake,
      marketId: q.marketId,
      strike: q.strike,
      entryPrice: q.entryPrice,
      payoutMultiplier: q.payoutMultiplier,
      windowSeconds: q.windowSeconds,
    },
  };
}
