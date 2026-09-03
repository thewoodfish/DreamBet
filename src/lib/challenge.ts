import { createStartParam, decodeStartParam } from "@telegram-apps/sdk-react";
import { isTradableAsset, type TradableAsset } from "@/lib/dreamdex/config";
import type { Direction } from "@/lib/round";

/**
 * The bot and Mini App a challenge link points back at. Without them a link can
 * still be built and shared — it just opens the site rather than the Mini App,
 * which is what a browser preview wants anyway.
 */
const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT;
const APP = process.env.NEXT_PUBLIC_TELEGRAM_APP;

/**
 * A bet somebody is daring the group to take the other side of. This is the
 * whole viral loop: it travels as a link, and the side it names is the side the
 * recipient is invited to oppose.
 */
export interface Challenge {
  /** Telegram handle of whoever threw it, without the @. */
  from: string | null;
  symbol: TradableAsset;
  /** The side *they* took. The counter-bet is the other one. */
  direction: Direction;
}

/**
 * The link that carries a challenge. Telegram start parameters are short and
 * base64url-encoded, so the payload is deliberately terse — three fields, one
 * letter each.
 */
export function challengeUrl(challenge: Challenge): string {
  const param = unpad(
    createStartParam({
      f: challenge.from ?? "",
      s: challenge.symbol,
      d: challenge.direction,
    })
  );

  return BOT && APP
    ? `https://t.me/${BOT}/${APP}?startapp=${param}`
    : `${origin()}/?startapp=${param}`;
}

/**
 * Read a challenge back out of a start parameter.
 *
 * This is attacker-supplied: it arrives from whatever link the user tapped, and
 * a link can be edited by anyone who forwards it. Every field is therefore
 * checked against what the app actually supports rather than trusted, and
 * anything unrecognised yields no challenge at all — never a partly-filled one
 * that would put the UI in a state the rest of the app does not expect.
 */
export function parseChallenge(raw: string | undefined | null): Challenge | null {
  if (!raw) return null;

  try {
    const decoded = decodeStartParam(pad(raw), "json");
    if (typeof decoded !== "object" || decoded === null) return null;

    const { f, s, d } = decoded as Record<string, unknown>;
    // An asset with no event contract behind it is not something to land on,
    // however the link spells it.
    if (typeof s !== "string" || !isTradableAsset(s)) return null;
    if (d !== "up" && d !== "down") return null;

    return {
      // A handle is only ever rendered, never trusted — but it is still capped,
      // because a link is free to carry a kilobyte of one.
      from: typeof f === "string" && f.length > 0 ? f.slice(0, 32) : null,
      symbol: s,
      direction: d,
    };
  } catch {
    return null;
  }
}

/** Pull a challenge out of a URL's query string. */
export function challengeFromSearch(search: string): Challenge | null {
  return parseChallenge(new URLSearchParams(search).get("startapp"));
}

/* --- The words that make somebody tap it --------------------------------- */

/** A bet just placed. */
export function betText(
  challenge: Challenge,
  stake: string,
  collateral: string
): string {
  return `🔥 ${who(challenge)} just bet ${stake} ${collateral} that ${challenge.symbol} goes ${side(challenge)} in the next 15 mins via #DreamBet. Take the other side:`;
}

/**
 * A window already decided. A win is worth bragging about and a miss is not, so
 * the two are not the same sentence — but both end in the same invitation,
 * because the point of sending either is to pull somebody into the next round.
 */
export function resultText(
  challenge: Challenge,
  net: string,
  won: boolean,
  voided: boolean,
  collateral: string
): string {
  if (voided) {
    return `${who(challenge)} called ${challenge.symbol} ${side(challenge)} on #DreamBet — the window voided. Running it back:`;
  }
  return won
    ? `🔥 ${who(challenge)} just won ${net} ${collateral} calling ${challenge.symbol} ${side(challenge)} in 15 mins on #DreamBet. Think you can beat that?`
    : `${who(challenge)} called ${challenge.symbol} ${side(challenge)} on #DreamBet and missed it. Your turn:`;
}

function who(challenge: Challenge): string {
  return challenge.from ? `@${challenge.from}` : "Someone";
}

function side(challenge: Challenge): string {
  return challenge.direction === "up" ? "UP" : "DOWN";
}

/**
 * Telegram accepts `[A-Za-z0-9_-]` in a start parameter and nothing else, so
 * the "=" the encoder pads base64 with would have the link rejected outright.
 * Padding is not part of canonical base64url anyway — it is recoverable from
 * the length, which is exactly what `pad` does on the way back in.
 */
function unpad(param: string): string {
  return param.replace(/=+$/, "");
}

/**
 * Put the padding back before decoding. Beyond our own links, anything that
 * forwards a URL is free to strip a trailing "=", so a link arriving without
 * one is a link to honour rather than a challenge to throw away.
 */
function pad(param: string): string {
  const short = param.length % 4;
  return short === 0 ? param : param + "=".repeat(4 - short);
}

function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}
