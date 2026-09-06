import { SomniaMarkets, quoteBinaryStakeOverBook } from "@somnia-chain/markets-sdk";
import type { BinaryOrderBook, PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { toDreamdexMarket, quoteFromProbability, clampProbability, isTrading, pickTradableMarket, marketBoundary, resolvedDirection, livenessAfterPoll, LIVENESS_STALL_MS } from "../src/lib/dreamdex/market.ts";
import { STRIKE_SCALE, APP_CADENCE_SECONDS, TRADED_CADENCES, TRADABLE_ASSETS, PRICE_SERIES_CADENCE_SECONDS } from "../src/lib/dreamdex/config.ts";
import { buySideFor, descale, toRaw } from "../src/lib/dreamdex/book.ts";
import { fillOf, EmptyFillError } from "../src/lib/dreamdex/trade.ts";
import { netResult } from "../src/lib/round.ts";
import { countdownTicks, windowLabel } from "../src/lib/format.ts";
import { rememberPosition, recallPosition, forgetPosition } from "../src/lib/position-store.ts";
import { streakOf, bestStreakOf, betNet } from "../src/lib/leaderboard.ts";
import { formatRelativeTime } from "../src/lib/format.ts";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { challengeUrl, parseChallenge, challengeFromSearch, betText, resultText } from "../src/lib/challenge.ts";
import { typicalMovePct, distancePct, minutesOfMovement, closeness, outcomeStreak, readPulse, formatPctValue } from "../src/lib/pulse.ts";

let fail = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
};

const finish = () => {
  console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURE(S)`);
  process.exit(fail === 0 ? 0 : 1);
};

/**
 * Everything below the pure section talks to a live third-party venue, and so
 * reports on Somnia's health as much as on this code: its indexer times out,
 * its oracle goes stale, and its 15m series stops rolling — none of which is a
 * regression here. `--pure` stops before any of that, which is what CI gates
 * on; the full run is how you check the app against the real thing.
 */
const PURE_ONLY = process.argv.includes("--pure");

// --- stake sizing and fills: pure, and first, so they still report when the
// --- indexer is unreachable ---
const D = 6;
const ONE = 10n ** BigInt(D);
const level = (price: number, qty: number) => ({
  price: BigInt(Math.round(price * Number(ONE))),
  quantity: BigInt(Math.round(qty * Number(ONE))),
});
// A YES book with asks at 0.50 and 0.55; the NO sides are the inverse.
const book: BinaryOrderBook = {
  yesAsks: [level(0.50, 40), level(0.55, 200)],
  yesBids: [level(0.45, 60), level(0.40, 200)],
  noAsks: [level(0.55, 60), level(0.60, 200)],
  noBids: [level(0.50, 40), level(0.45, 200)],
};
const grid = { tickSize: ONE / 1000n, lotSize: ONE / 100n, minQuantity: ONE / 10n };

ok("UP buys YES and DOWN buys NO", buySideFor("up") === "BUY_YES" && buySideFor("down") === "BUY_NO");
ok("a stake descales and rescales to itself", descale(toRaw(12.34, D), D) === 12.34);
ok("sub-unit dust is dropped, never rounded up", toRaw(1.0000009, 6) === 1_000_000n);
ok("a zero or negative stake sizes nothing", toRaw(0, D) === 0n && toRaw(-5, D) === 0n);

for (const side of ["BUY_YES", "BUY_NO"] as const) {
  const q = quoteBinaryStakeOverBook(book, side, toRaw(20, D), ONE, grid)!;
  ok(`${side}: a 20 stake is sized against the book`, q !== null);
  // The whole point of sizing over the book: the escrow is the max loss, and it
  // can never exceed what the user typed.
  ok(`${side}: escrow never exceeds the stake`, q.escrow <= toRaw(20, D), `${descale(q.escrow, D)}`);
  ok(`${side}: shares exceed the stake, so the bet can pay`, q.quantity > q.escrow);
  ok(`${side}: the quantity sits on the lot grid`, q.quantity % grid.lotSize === 0n);
  ok(`${side}: the limit sits on the tick grid`, q.yesPrice % grid.tickSize === 0n);
  console.log(`   ${side}: ${descale(q.quantity, D)} shares for ${descale(q.escrow, D)}` +
    `  (${(descale(q.quantity, D) / descale(q.escrow, D)).toFixed(2)}x)`);
}

ok("an empty book sizes nothing rather than a doomed order",
   quoteBinaryStakeOverBook({ yesAsks: [], yesBids: [], noAsks: [], noBids: [] }, "BUY_YES", toRaw(20, D), ONE, grid) === null);
ok("a stake below one lot sizes nothing",
   quoteBinaryStakeOverBook(book, "BUY_YES", toRaw(0.001, D), ONE, grid) === null);
ok("a bigger stake eats worse levels, so its multiplier is never better", (() => {
  const small = quoteBinaryStakeOverBook(book, "BUY_YES", toRaw(5, D), ONE, grid)!;
  const large = quoteBinaryStakeOverBook(book, "BUY_YES", toRaw(60, D), ONE, grid)!;
  const rate = (q: typeof small) => Number(q.quantity) / Number(q.escrow);
  return rate(large) <= rate(small) + 1e-9;
})());

// --- fills: what the order really did, in the outcome's own terms ---
const receipt = (fills: [number, number][]): PlaceOrderResult => ({
  hash: "0xfeed" as `0x${string}`,
  receipt: {} as PlaceOrderResult["receipt"],
  fills: fills.map(([price, qty]) => ({
    takerOrderId: 0n, makerOrderId: 0n, takerRemainingQuantity: 0n, makerRemainingQuantity: 0n,
    quantityFilled: BigInt(Math.round(qty * Number(ONE))),
    fillPrice: BigInt(Math.round(price * Number(ONE))),
  })),
});
const quoteFor = (side: "BUY_YES" | "BUY_NO") => ({ side } as Parameters<typeof fillOf>[1]);

// 10 shares at a YES print of 0.50 costs 5 to the UP side.
ok("an UP fill is priced at the YES print", (() => {
  const f = fillOf(receipt([[0.5, 10]]), quoteFor("BUY_YES"), D);
  return f.shares === 10 && f.cost === 5 && Math.abs(f.payoutMultiplier - 2) < 1e-12;
})());
// The same print costs the DOWN side 0.50 — buying NO at 1 − 0.50.
ok("a DOWN fill is priced at the inverse of the YES print", (() => {
  const f = fillOf(receipt([[0.8, 10]]), quoteFor("BUY_NO"), D);
  return f.shares === 10 && Math.abs(f.cost - 2) < 1e-9 && Math.abs(f.payoutMultiplier - 5) < 1e-9;
})());
ok("a multi-level fill blends into one average, not the best price", (() => {
  const f = fillOf(receipt([[0.5, 10], [0.6, 10]]), quoteFor("BUY_YES"), D);
  return f.shares === 20 && Math.abs(f.cost - 11) < 1e-9;
})());
ok("an order that crossed nothing is not a position", (() => {
  try { fillOf(receipt([]), quoteFor("BUY_YES"), D); return false; }
  catch (e) { return e instanceof EmptyFillError; }
})());
ok("the recorded multiplier pays out what the fill promised", (() => {
  const f = fillOf(receipt([[0.4, 25]]), quoteFor("BUY_YES"), D);
  const pos = { direction: "up" as const, stake: f.cost, marketId: "0x0" as `0x${string}`,
                strike: 100, entryPrice: 100, payoutMultiplier: f.payoutMultiplier };
  // Winning returns the shares: profit is shares minus what they cost.
  return Math.abs(netResult(pos, "up") - (f.shares - f.cost)) < 1e-9;
})());

// --- challenge links: the viral loop, and the only attacker-supplied input ---
const dare = { from: "kelechi", symbol: "BTC" as const, direction: "up" as const };
const link = challengeUrl(dare);
const param = new URL(link, "http://x").searchParams.get("startapp")!;

ok("a challenge survives the round trip through a link", (() => {
  const back = parseChallenge(param);
  return back?.from === "kelechi" && back.symbol === "BTC" && back.direction === "up";
})(), link);
ok("the same challenge is readable straight off a query string",
   challengeFromSearch(`?startapp=${param}`)?.symbol === "BTC");
// Telegram accepts [A-Za-z0-9_-] in a start parameter and nothing else, so a
// link carrying base64 padding would be refused before it ever opened.
ok("the link carries a start param Telegram will accept",
   /^[A-Za-z0-9_-]{1,512}$/.test(param), param);
ok("a link that lost its padding in transit still decodes", (() => {
  const stripped = param.replace(/=+$/, "");
  return parseChallenge(stripped)?.symbol === "BTC";
})());
ok("an anonymous challenge round-trips as anonymous",
   parseChallenge(new URL(challengeUrl({ ...dare, from: null }), "http://x").searchParams.get("startapp")!)?.from === null);

// Every one of these is something a forwarded link can be edited to say.
ok("no start param is no challenge",
   parseChallenge(undefined) === null && parseChallenge("") === null && parseChallenge(null) === null);
ok("a start param that isn't a challenge is rejected",
   parseChallenge("not-base64url!!") === null);
ok("an untradable asset is refused, however the link spells it", (() => {
  const forged = Buffer.from(JSON.stringify({ f: "x", s: "SOMI", d: "up" })).toString("base64url");
  return parseChallenge(forged) === null;
})());
ok("an unknown direction is refused rather than defaulted", (() => {
  const forged = Buffer.from(JSON.stringify({ f: "x", s: "BTC", d: "sideways" })).toString("base64url");
  return parseChallenge(forged) === null;
})());
ok("a missing field yields no challenge, not a half-filled one", (() => {
  const forged = Buffer.from(JSON.stringify({ s: "BTC" })).toString("base64url");
  return parseChallenge(forged) === null;
})());
ok("a JSON array is not a challenge",
   parseChallenge(Buffer.from(JSON.stringify(["BTC", "up"])).toString("base64url")) === null);
ok("an oversized handle is capped rather than rendered whole", (() => {
  const forged = Buffer.from(JSON.stringify({ f: "a".repeat(500), s: "ETH", d: "down" })).toString("base64url");
  return parseChallenge(forged)?.from?.length === 32;
})());

// The share copy has to name the right side and the right money, because it is
// the only part of this product that strangers ever read.
ok("the bet copy names the side taken and invites the other",
   betText(dare, "50.00", "tUSDC", "15 min").includes("BTC goes UP") &&
   betText(dare, "50.00", "tUSDC", "15 min").includes("50.00 tUSDC") &&
   betText(dare, "50.00", "tUSDC", "15 min").includes("other side"));
ok("a win brags and a miss does not", (() => {
  const won = resultText(dare, "27.00", true, false, "tUSDC", "15 min");
  const lost = resultText(dare, "50.00", false, false, "tUSDC", "15 min");
  return won.includes("just won 27.00 tUSDC") && !lost.includes("won") && lost.includes("missed");
})());
ok("a void is neither a win nor a loss in the copy", (() => {
  const void_ = resultText(dare, "0.00", false, true, "tUSDC", "15 min");
  return void_.includes("voided") && !void_.includes("missed") && !void_.includes("won");
})());
ok("an anonymous player is still named something",
   betText({ ...dare, from: null }, "5.00", "tUSDC", "15 min").startsWith("🔥 Someone"));

// The app trades whichever cadence is open, so the card has to name that one —
// a bet into an hourly window described as "15 mins" is a lie to everybody who
// reads it, and the reader cannot check.
ok("the copy names the window the bet actually went into", (() => {
  const hourly = betText(dare, "50.00", "tUSDC", windowLabel(3600));
  const fast = betText(dare, "50.00", "tUSDC", windowLabel(300));
  return hourly.includes("next 1 hour") && fast.includes("next 5 min");
})());
ok("window lengths read the way a player would say them",
   windowLabel(60) === "1 min" && windowLabel(900) === "15 min" &&
   windowLabel(3600) === "1 hour" && windowLabel(14400) === "4 hours");

// --- what a settled bet was worth, shared by the standings and the history ---
//
// One bet must never be worth two different numbers on two screens, which is
// why both read this. A win returns the tokens bought and costs the stake.
{
  const won = { side: "down", stake: 10, shares: 18.5 };
  ok("a winning bet returns its shares less the stake",
     betNet(won, "down") === 8.5);
  ok("a losing bet costs exactly the stake",
     betNet({ side: "up", stake: 25, shares: 41 }, "down") === -25);
  ok("a void costs nothing, whichever side it was on",
     betNet(won, "void") === 0 &&
     betNet({ side: "up", stake: 40, shares: 70 }, "void") === 0);
  // The losing case must not quietly return the shares it never got.
  ok("a loss is never softened by the shares that did not pay",
     betNet({ side: "up", stake: 5, shares: 1000 }, "down") === -5);
}

// --- when a bet happened, said the way a person would ---
{
  const now = Date.UTC(2026, 8, 6, 12, 0, 0);
  const ago = (ms: number) => formatRelativeTime(now - ms, now);
  ok("a bet from seconds ago is just now", ago(20_000) === "just now");
  ok("minutes read as minutes", ago(15 * 60_000) === "15m ago");
  ok("an hour is not sixty minutes", ago(3 * 3600_000) === "3h ago");
  ok("a day is not twenty-four hours", ago(2 * 86_400_000) === "2d ago");
  ok("a clock that disagrees does not produce a negative age",
     formatRelativeTime(now + 60_000, now) === "just now");
}

// --- the streak: the number that decides whether tomorrow's round matters ---
//
// Results arrive newest-first, so the current streak reads off the front and
// stops at the first loss. It was a hardcoded 4 until now, which is the app
// claiming a history its player never lived.
ok("a streak counts wins back from the most recent bet",
   streakOf([true, true, true, false, true]) === 3);
ok("a streak is zero the moment the last bet lost",
   streakOf([false, true, true, true]) === 0);
ok("no settled bets is no streak", streakOf([]) === 0);
ok("an unbroken record is all of it", streakOf([true, true]) === 2);

ok("the best run is the longest anywhere, not the current one",
   bestStreakOf([false, true, true, true, false, true]) === 3);
ok("the best run survives a loss at the front",
   bestStreakOf([false, true, true]) === 2 && streakOf([false, true, true]) === 0);
ok("no record is no best run", bestStreakOf([]) === 0);

// --- the remembered bet: local storage is attacker-editable input ---
//
// This record decides what the settlement takeover claims the player won. It
// lives in a store they can edit by hand, so every field is checked on the way
// back in and anything unexpected reads as "no open bet" rather than as a
// position with a plausible-looking payout.
{
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };

  const good = {
    symbol: "BTC" as const,
    position: {
      direction: "up" as const,
      stake: 10,
      marketId: "0xabc123" as `0x${string}`,
      strike: 79765.24,
      entryPrice: 79770,
      payoutMultiplier: 1.85,
      windowSeconds: 900,
    },
    expiresAt: Date.now() + 60_000,
    placedAt: Date.now(),
  };

  rememberPosition(good);
  const back = recallPosition();
  ok("a remembered bet comes back with its stake and side intact",
     back?.position.stake === 10 && back?.position.direction === "up" &&
     back?.symbol === "BTC" && back?.position.payoutMultiplier === 1.85);

  ok("nothing remembered is no open bet",
     (forgetPosition(), recallPosition() === null));

  // Each of these is a hand-edited record the overlay must refuse to dress up.
  const tampered: [string, unknown][] = [
    ["a stake that was never paid", { ...good, position: { ...good.position, stake: -5 } }],
    ["a payout that loses on a win", { ...good, position: { ...good.position, payoutMultiplier: 0.2 } }],
    ["an asset with no market", { ...good, symbol: "DOGE" }],
    ["a market id that is not one", { ...good, position: { ...good.position, marketId: "not-a-market" } }],
    ["a strike of zero", { ...good, position: { ...good.position, strike: 0 } }],
    ["no position at all", { symbol: "BTC", expiresAt: 1, placedAt: 1 }],
    ["not an object", "hello"],
  ];
  for (const [label, value] of tampered) {
    (globalThis as { window: { localStorage: { setItem(k: string, v: string): void } } })
      .window.localStorage.setItem("dreambet.position.v1", JSON.stringify(value));
    ok(`a remembered bet is refused: ${label}`, recallPosition() === null);
  }

  // Garbage that is not even JSON must not throw on the way past.
  (globalThis as { window: { localStorage: { setItem(k: string, v: string): void } } })
    .window.localStorage.setItem("dreambet.position.v1", "{not json");
  ok("an unparseable record is discarded rather than thrown", recallPosition() === null);

  rememberPosition({ ...good, placedAt: Date.now() - 25 * 60 * 60 * 1000 });
  ok("a bet older than a day is let go rather than ambushing its owner",
     recallPosition() === null);

  delete (globalThis as { window?: unknown }).window;
}

// --- the line a window settles against, per resolution mode ---
//
// A fixed-strike market carries its line in the question and never posts a
// reference print, so `posted` is false on it forever. Requiring `posted`
// regardless of mode made every fixed-strike window unbettable — the app sat
// on "waiting for this window's opening price" holding a row with the price in
// it. The 5-minute series is fixed-strike, so that was half the board.
ok("a fixed-strike window's line is its strike, with no opening print needed",
   marketBoundary({ marketId: "0xabc", strike: "7976524" } as unknown as BinaryMarket, {}) === 79765.24);
ok("a reference window with nothing posted still has no line",
   marketBoundary({ marketId: "0xdef", strike: "0" } as unknown as BinaryMarket, { "0xdef": null }) === null);

// --- the market pulse: arithmetic on real prints, and the words it produces ---
//
// A walk that steps exactly 1% each minute, so "typical move" has a known
// answer and every ratio built on it can be checked by hand.
const WALK = Array.from({ length: 20 }, (_, i) => 100 * 1.01 ** i);
ok("a steady 1% walk reports a 1% typical move",
   Math.abs(typicalMovePct(WALK)! - 1) < 1e-9, `${typicalMovePct(WALK)}`);
ok("one spike does not become the typical move", (() => {
  const spiked = [...WALK];
  spiked[10] = spiked[10] * 3;   // a tripling, then a fall straight back
  const median = typicalMovePct(spiked)!;
  return Math.abs(median - 1) < 0.2;  // a mean would be dragged far past this
})(), `${typicalMovePct((() => { const s = [...WALK]; s[10] *= 3; return s; })())}`);
ok("a flat series has no typical move rather than a zero one",
   typicalMovePct([100, 100, 100]) === null);
// A stalled oracle republishes its last answer, which is most of the series by
// the time anyone notices. Counting those repeats as zero-sized moves would put
// the median at zero and report a moving market as motionless.
ok("a feed that stalls half the hour still reports the half it measured", (() => {
  const moved = [100, 101, 102, 103, 104];        // 5 real 1% moves
  const stalled = Array.from({ length: 30 }, () => 104);
  const median = typicalMovePct([...moved, ...stalled]);
  return median !== null && Math.abs(median - 1) < 0.05;
})(), `${typicalMovePct([100, 101, 102, 103, 104, ...Array.from({ length: 30 }, () => 104)])}`);
ok("a series too short to have moved yields nothing",
   typicalMovePct([]) === null && typicalMovePct([100]) === null);

ok("distance is signed from the line, not absolute",
   distancePct(101, 100) === 1 && distancePct(99, 100) === -1);
ok("no price or no line is no distance",
   distancePct(null, 100) === null && distancePct(100, null) === null &&
   distancePct(100, 0) === null);

ok("distance reads as minutes of ordinary movement",
   minutesOfMovement(0.5, 0.1) === 5 && minutesOfMovement(-0.5, 0.1) === 5);

// The comparison the whole panel turns on: the same distance is a coin flip
// with ten minutes to run and a settled question with one.
ok("a line well within reach is too close to call",
   closeness(1, 10 * 60) === "coin-flip");
ok("a line about as far as the time allows is a lean",
   closeness(8, 10 * 60) === "leaning");
ok("a line further than the time allows is a clear lead",
   closeness(20, 10 * 60) === "clear");
ok("an expired or unmeasurable window claims nothing",
   closeness(5, 0) === "unknown" && closeness(null, 600) === "unknown");

ok("a run of same-side windows is a streak",
   outcomeStreak(["up", "up", "up", "down"])?.length === 3);
ok("a streak is counted from the newest window, not the longest run",
   outcomeStreak(["down", "up", "up", "up"])?.side === "down" &&
   outcomeStreak(["down", "up", "up", "up"])?.length === 1);
ok("a void breaks a run rather than joining a side",
   outcomeStreak(["void", "up", "up"]) === null &&
   outcomeStreak(["up", "void", "up"])?.length === 1);
ok("no history is no streak", outcomeStreak([]) === null);

ok("hundredths of a percent survive being formatted",
   formatPctValue(0.043) === "0.043%" && formatPctValue(2.5) === "2.5%");

// The sentence has to stay true to whichever facts exist, including none.
const basePulse = {
  symbol: "BTC", price: 101, boundary: 100, history: WALK,
  secondsLeft: 600, recent: [] as ("up"|"down"|"void")[],
  upProbability: 0.5, book: null, group: null,
};
ok("the copy never advises a side", (() => {
  const said = [
    readPulse(basePulse).sentence,
    readPulse({ ...basePulse, price: 100.01 }).sentence,
    readPulse({ ...basePulse, price: 90, secondsLeft: 30 }).sentence,
    readPulse({ ...basePulse, recent: ["up","up","up","up"] }).sentence,
  ].join(" ").toLowerCase();
  return !/\bbet\b|\bshould\b|\blikely\b|\bwill\b|\bpredict/.test(said);
})());
ok("a window with no line posted says so instead of inventing one",
   readPulse({ ...basePulse, boundary: null }).sentence.includes("no line posted"));
ok("an untraded book is called indicative",
   readPulse({ ...basePulse, upProbability: null }).sentence.includes("indicative"));
// This venue voids windows in stretches. Six unexplained grey marks in the
// strip is a fact shown with its meaning withheld.
ok("a run of voids is explained rather than left as grey marks", (() => {
  const s = readPulse({ ...basePulse,
    recent: ["void","void","void","void","up","down"] }).sentence;
  return s.includes("4 of the last 6 windows") && s.includes("stakes returned");
})());
ok("the odd void is not worth a sentence",
   !readPulse({ ...basePulse, recent: ["void","up","down","up","down","up"] })
     .sentence.includes("stakes returned"));
ok("a streak is reported with the side it actually ran on",
   readPulse({ ...basePulse, recent: ["down","down","down"] }).sentence.includes("closed DOWN"));
ok("the group tally is a count, never a name", (() => {
  const s = readPulse({ ...basePulse,
    group: { up: 3, down: 1, upStake: 30, downStake: 10, scope: "group" as const } }).sentence;
  return s.includes("3 of your group took UP");
})());
ok("a far line with seconds left reads as clear, not as a flip",
   readPulse({ ...basePulse, price: 130, secondsLeft: 30 }).closeness === "clear");
// 100% away over a 1%-a-minute walk is a hundred minutes, which is a number
// nobody needs to hear when there are thirty seconds left.
ok("an absurdly distant line is capped rather than counted out in minutes",
   readPulse({ ...basePulse, price: 200, secondsLeft: 30 }).sentence.includes("over an hour"));
ok("a distance inside the cap still reads in minutes",
   readPulse({ ...basePulse, price: 130, secondsLeft: 30 }).sentence.includes("about 30 minutes"));

// --- the pill row: what one poll of an asset's board means for it ---
//
// Pure, and so gated in CI: the asymmetry here is what stops the row blinking
// out at every window roll while still turning a genuinely dark asset off.
const PILL_NOW = Date.now();
ok("anything open makes an asset live at once",
   livenessAfterPoll(true, null, PILL_NOW) === "live");
ok("an asset never seen open is paused without waiting out the bridge",
   livenessAfterPoll(false, null, PILL_NOW) === "paused");
ok("a roll between two windows does not blink the pill out",
   livenessAfterPoll(false, PILL_NOW - 5_000, PILL_NOW) === "live");
ok("a venue that has stopped rolling does turn the pill off",
   livenessAfterPoll(false, PILL_NOW - LIVENESS_STALL_MS - 1, PILL_NOW) === "paused");
ok("the pill and the countdown call a stall at the same moment",
   livenessAfterPoll(false, PILL_NOW - LIVENESS_STALL_MS + 1_000, PILL_NOW) === "live" &&
   livenessAfterPoll(false, PILL_NOW - LIVENESS_STALL_MS - 1_000, PILL_NOW) === "paused");

// --- the fuse divides every traded cadence into a countable number of ticks ---
ok("every traded cadence draws a countable fuse",
   TRADED_CADENCES.every((c) => {
     const n = countdownTicks(c, -1);
     return n >= 8 && n <= 24;
   }), TRADED_CADENCES.map((c) => `${c}s→${countdownTicks(c)}`).join(" "));
ok("a window off the ladder falls back rather than drawing nothing",
   countdownTicks(86400, 15) === 15 && countdownTicks(0, 15) === 15);

if (PURE_ONLY) finish();

const ex = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
});
const raw = await ex.client.listBinaryMarkets({ limit: 25 });
console.log(`fetched ${raw.length} live markets\n`);

const mkts = raw.map(toDreamdexMarket);

// --- strike descaling matches the human-readable question text ---
let checked = 0;
for (const [i, m] of mkts.entries()) {
  const q = (raw[i].question || "").match(/at or above ([\d.]+)/);
  if (!q || m.mode !== "fixed") continue;
  checked++;
  ok(`strike descales to question text (${m.asset})`, Math.abs(m.strike! - Number(q[1])) < 1e-9,
     `${m.strike} vs ${q[1]}`);
}
ok("at least one fixed-strike market checked", checked > 0);

// --- reference-mode markets expose no strike ---
const ref = mkts.filter((m) => m.mode === "reference");
ok("reference markets carry a null strike, not 0", ref.every((m) => m.strike === null),
   `(${ref.length} reference markets)`);

// --- window shape ---
ok("windows are positive and match expiry-tradingStart",
   mkts.every((m) => m.windowSeconds === m.expiry - m.tradingStart && m.windowSeconds > 0));
console.log("   window lengths seen:", [...new Set(mkts.map((m) => m.windowSeconds))].sort((a,b)=>a-b).join("s, ") + "s");
console.log("   assets seen:", [...new Set(mkts.map((m) => m.asset))].join(", "));

// --- token ids / addresses survive normalisation ---
ok("yes and no token ids are distinct bigints",
   mkts.every((m) => m.yesTokenId !== m.noTokenId && typeof m.yesTokenId === "bigint"));
// --- trading state comes from the clock, not the status stamp ---
const NOW = Date.now();
ok("nothing halted or outside its window is called tradeable",
   mkts.filter((m) => isTrading(m, NOW)).every((m) =>
     !["Locked","Settling","Resolved","Voided","Finalized"].includes(m.status) &&
     m.tradingStart <= NOW/1000 && m.expiry > NOW/1000));
ok("a Listed market already past tradingStart still counts as live", (() => {
  const listed = mkts.filter((m) => m.status === "Listed" && m.tradingStart <= NOW/1000 && m.expiry > NOW/1000);
  // Vacuously true when the board has none right now; the point is that
  // `status === "Trading"` is never what decides it.
  return listed.every((m) => isTrading(m, NOW));
})());
ok("volume descales to whole collateral units",
   mkts.every((m) => m.volume >= 0 && (m.tradeCount > 0 || m.volume === 0)));

// --- economics: price IS the probability, payout is its reciprocal ---
const q54 = quoteFromProbability(0.54);
ok("UP at 0.54 pays 1.85x", Math.abs(q54.payoutUp - 1 / 0.54) < 1e-12, `${q54.payoutUp.toFixed(4)}`);
ok("DOWN at 0.54 pays 2.17x", Math.abs(q54.payoutDown - 1 / 0.46) < 1e-12, `${q54.payoutDown.toFixed(4)}`);
ok("a complete set costs 1 collateral (1/pUp + 1/pDown reciprocals sum to 1)",
   Math.abs(1 / q54.payoutUp + 1 / q54.payoutDown - 1) < 1e-12);
ok("even money pays 2x both sides", (() => {
  const q = quoteFromProbability(0.5);
  return Math.abs(q.payoutUp - 2) < 1e-12 && Math.abs(q.payoutDown - 2) < 1e-12;
})());
ok("an untraded book is flagged indicative, not quoted as real",
   quoteFromProbability(null).isIndicative && !quoteFromProbability(0.6).isIndicative);
ok("payouts stay finite at the extremes",
   Number.isFinite(quoteFromProbability(0).payoutUp) &&
   Number.isFinite(quoteFromProbability(1).payoutDown) &&
   Number.isFinite(quoteFromProbability(Number.NaN).payoutUp));
ok("clamp keeps probability inside (0,1)",
   clampProbability(0) > 0 && clampProbability(1) < 1 && clampProbability(0.5) === 0.5);
ok("higher probability always means smaller payout",
   [0.1,0.3,0.5,0.7,0.9].every((p,i,a) => i===0 || quoteFromProbability(p).payoutUp < quoteFromProbability(a[i-1]).payoutUp));

// --- the window the app would actually trade, per asset ---
//
// The app prefers 15m and falls back through the other cadences, so this asks
// the same way. Asserting a live 15m series would fail whenever this venue's
// short-cadence creators are stopped — which is most of the time, and is a
// fact about their testnet rather than a regression here.
for (const asset of TRADABLE_ASSETS) {
  const boards = await Promise.all(
    TRADED_CADENCES.map((intervalSec) =>
      ex.client.listLiveBinaryMarkets({ asset, intervalSec, limit: 10 })
    )
  );
  const rows = boards.find((b) => pickTradableMarket(b.map(toDreamdexMarket), NOW)) ?? boards.flat();
  const live = rows.map(toDreamdexMarket);
  const picked = pickTradableMarket(live, NOW);
  // Whether a given asset has anything open is the venue's business, not this
  // app's — SOL has been dark for hours — so the assertion is that the pill row
  // would say so, not that the venue is rolling it.
  ok(`${asset}: the pill row would describe this asset correctly`,
     livenessAfterPoll(picked !== null, null, NOW) === (picked ? "live" : "paused"),
     `(${live.length} live across ${TRADED_CADENCES.join("/")}s → ${picked ? "live" : "paused"})`);
  ok(`${asset}: every row is the asset asked for, on a traded cadence`,
     live.every((m) => m.asset === asset &&
       TRADED_CADENCES.some((c) => Math.abs(m.windowSeconds - c) <= 5)));
  if (picked) {
    const q = quoteFromProbability(picked.lastProbability);
    ok(`${asset}: picked window is open and has room to bet`,
       isTrading(picked, NOW) && picked.expiry - NOW/1000 >= 5);
    console.log(`   ${asset} quote: ${(q.upProbability*100).toFixed(1)}% UP` +
      `  ${q.payoutUp.toFixed(2)}x / ${q.payoutDown.toFixed(2)}x` +
      `  ${q.isIndicative ? "(indicative, untraded)" : `(${picked.tradeCount} trades, vol ${picked.volume})`}` +
      `  ${Math.round(picked.expiry - NOW/1000)}s left`);
  } else {
    console.log(`   ${asset}: nothing open on any traded cadence — its pill shows paused`);
  }
}

// --- a market about to expire is not offered as something to bet into ---
ok("a window with seconds left is skipped, not offered", (() => {
  const expiring = mkts.map((m) => ({ ...m, expiry: Math.floor(NOW/1000) + 2 }));
  return pickTradableMarket(expiring, NOW) === null;
})());

// --- the boundary: the line a 15m window actually settles against ---
for (const asset of TRADABLE_ASSETS) {
  const rows = await ex.client.listLiveBinaryMarkets({ asset, intervalSec: APP_CADENCE_SECONDS, limit: 5 });
  const picked = rows.find((r) => isTrading(toDreamdexMarket(r), NOW));
  if (!picked) { console.log(`   ${asset}: no live window to read a boundary from`); continue; }

  const opening = await ex.client.getOpeningPrices([picked.marketId]);
  const boundary = marketBoundary(picked, opening);
  // Split by mode, because only one of them is allowed to be missing a line:
  // a reference window genuinely has none for its first seconds, a fixed one
  // never does. The old single assertion could not fail on a fixed market at
  // all, which is how it passed all day while they were unbettable.
  ok(`${asset}: a fixed-strike window exposes its line at once`,
     picked.mode !== "fixed" || boundary !== null, `mode=${picked.mode} boundary=${boundary}`);
  ok(`${asset}: a reference window's line is a real price once posted`,
     picked.mode !== "reference" || boundary === null || boundary > 0, `boundary=${boundary}`);
  ok(`${asset}: the window the app picked can actually be bet`,
     boundary !== null || picked.mode === "reference", `mode=${picked.mode} boundary=${boundary}`);

  // The boundary must be on the same scale as the price the chart plots, or
  // the strike line lands somewhere meaningless.
  const series = await ex.client.listPastBinaryMarkets({ asset, intervalSec: PRICE_SERIES_CADENCE_SECONDS, limit: 3 });
  const spot = Number(series[0]?.strike ?? 0) / STRIKE_SCALE;
  if (boundary !== null && spot > 0) {
    ok(`${asset}: boundary and chart price agree to within 5%`,
       Math.abs(boundary - spot) / spot < 0.05, `${boundary} vs ${spot}`);
  }
}

// --- the price series: real oracle prints, one a minute ---
for (const asset of TRADABLE_ASSETS) {
  const [past, live] = await Promise.all([
    ex.client.listPastBinaryMarkets({ asset, intervalSec: PRICE_SERIES_CADENCE_SECONDS, limit: 60 }),
    ex.client.listLiveBinaryMarkets({ asset, intervalSec: PRICE_SERIES_CADENCE_SECONDS, limit: 3 }),
  ]);
  const pts = [...past, ...live]
    .map((m) => ({ t: Number(m.tradingStart), p: Number(m.strike) / STRIKE_SCALE }))
    .filter((x) => x.p > 0)
    .sort((a, b) => a.t - b.t);
  const gaps = [...new Set(pts.slice(1).map((x, i) => x.t - pts[i].t))];

  // No 1m series at all means no chart for this asset — true of SOL, which has
  // never had one. Nothing below can be asserted about a series that does not
  // exist, and its absence is the venue's, so it is reported and skipped.
  if (pts.length === 0) {
    console.log(`   ${asset}: no 1m series — no oracle prints to chart`);
    continue;
  }

  ok(`${asset}: the 1m series yields an hour of prints`, pts.length >= 50, `${pts.length} points`);
  ok(`${asset}: prints land exactly one minute apart`,
     gaps.every((g) => g === PRICE_SERIES_CADENCE_SECONDS), `gaps: ${gaps.join(",")}`);
  ok(`${asset}: the freshest print is under two minutes old`,
     NOW/1000 - pts[pts.length-1].t < 120, `${Math.round(NOW/1000 - pts[pts.length-1].t)}s`);
}

// --- the verdict: read off the contract, and it matches the prices ---
// Across the cadences the app trades, not just the preferred one: the 15m
// series spends stretches voiding every window, and a check that can only read
// that series reports the venue's mood rather than this code's correctness.
//
// Each mode is checked against the line it actually settles on — a reference
// window against its opening print, a fixed-strike window against its strike.
// Reading only the opening price is what let the boundary bug above hide.
let checkedVerdicts = 0;
for (const intervalSec of TRADED_CADENCES) {
  if (checkedVerdicts >= 3) break;
  const settled = await ex.client.listPastBinaryMarkets({ asset: "BTC", intervalSec, limit: 6 });
  const sIds = settled.map((m) => m.marketId);
  const [opens, closes] = await Promise.all([
    ex.client.getOpeningPrices(sIds),
    ex.client.getResolutionPrices(sIds),
  ]);

  for (const raw of settled) {
    const m = toDreamdexMarket(raw);
    const dir = resolvedDirection(m);
    const c = closes[m.marketId.toLowerCase()];
    if (dir === null || c === null || c === undefined) continue;

    const line = m.mode === "fixed"
      ? Number(raw.strike)
      : Number(opens[m.marketId.toLowerCase()] ?? Number.NaN);
    if (!Number.isFinite(line) || line <= 0) continue;

    checkedVerdicts++;
    // "closes at or above the line" — outcome 0 (YES) must mean UP.
    ok(`settled ${intervalSec}s ${m.mode} window: verdict matches close vs line`,
       dir === (Number(c) >= line ? "up" : "down"),
       `${dir} line=${line} close=${c} winningOutcome=${m.winningOutcome}`);
  }
}
ok("at least one settled window was cross-checked", checkedVerdicts > 0);

// --- payouts follow the verdict, and a void returns the stake ---
const pos = { direction: "up" as const, stake: 50, marketId: "0x0" as `0x${string}`,
              strike: 100, entryPrice: 100, payoutMultiplier: 1.85 };
ok("a winning position pays the stake times the multiplier, less the stake",
   Math.abs(netResult(pos, "up") - 50 * 0.85) < 1e-9, `${netResult(pos, "up")}`);
ok("a losing position loses exactly the stake", netResult(pos, "down") === -50);
ok("a void is flat, not a loss", netResult(pos, null) === 0);

// --- the live book a bet would actually cross ---
for (const asset of TRADABLE_ASSETS) {
  const rows = await ex.client.listLiveBinaryMarkets({ asset, intervalSec: APP_CADENCE_SECONDS, limit: 5 });
  const picked = pickTradableMarket(rows.map(toDreamdexMarket), NOW);
  if (!picked) { console.log(`   ${asset}: no live window to price a bet into`); continue; }

  const decimals = picked.decimals;
  const one = 10n ** BigInt(decimals);
  const [live, params] = await Promise.all([
    ex.client.getBinaryOrderBook(picked.poolAddress, { depth: 10, decimals }),
    ex.client.getBinaryBookParams(picked.poolAddress),
  ]);
  const depth = live.yesAsks.length + live.yesBids.length;
  console.log(`   ${asset}: book has ${live.yesAsks.length} asks / ${live.yesBids.length} bids;` +
    ` tick ${descale(params.tickSize, decimals)}, lot ${descale(params.lotSize, decimals)},` +
    ` min ${descale(params.minQuantity, decimals)}`);

  ok(`${asset}: the pool reports a usable tick/lot grid`,
     params.tickSize > 0n && params.lotSize > 0n);
  const sized = quoteBinaryStakeOverBook(live, "BUY_YES", 10n * one, one, params);
  // An empty book is the ordinary state on these short windows, and sizing
  // nothing is the correct answer to it — not a failure.
  ok(`${asset}: a 10 stake either sizes within itself or sizes nothing`,
     sized === null || sized.escrow <= 10n * one,
     sized === null ? `(nothing resting, depth ${depth})` : `${descale(sized.escrow, decimals)} for ${descale(sized.quantity, decimals)} shares`);
}

finish();
