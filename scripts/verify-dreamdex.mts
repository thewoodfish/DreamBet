import { SomniaMarkets, quoteBinaryStakeOverBook } from "@somnia-chain/markets-sdk";
import type { BinaryOrderBook, PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { toDreamdexMarket, quoteFromProbability, clampProbability, isTrading, pickTradableMarket, marketBoundary, resolvedDirection } from "../src/lib/dreamdex/market.ts";
import { STRIKE_SCALE, APP_CADENCE_SECONDS, TRADABLE_ASSETS, PRICE_SERIES_CADENCE_SECONDS } from "../src/lib/dreamdex/config.ts";
import { buySideFor, descale, toRaw } from "../src/lib/dreamdex/book.ts";
import { fillOf, EmptyFillError } from "../src/lib/dreamdex/trade.ts";
import { netResult } from "../src/lib/round.ts";
import { challengeUrl, parseChallenge, challengeFromSearch, betText, resultText } from "../src/lib/challenge.ts";

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
   betText(dare, "50.00", "tUSDC").includes("BTC goes UP") &&
   betText(dare, "50.00", "tUSDC").includes("50.00 tUSDC") &&
   betText(dare, "50.00", "tUSDC").includes("other side"));
ok("a win brags and a miss does not", (() => {
  const won = resultText(dare, "27.00", true, false, "tUSDC");
  const lost = resultText(dare, "50.00", false, false, "tUSDC");
  return won.includes("just won 27.00 tUSDC") && !lost.includes("won") && lost.includes("missed");
})());
ok("a void is neither a win nor a loss in the copy", (() => {
  const void_ = resultText(dare, "0.00", false, true, "tUSDC");
  return void_.includes("voided") && !void_.includes("missed") && !void_.includes("won");
})());
ok("an anonymous player is still named something",
   betText({ ...dare, from: null }, "5.00", "tUSDC").startsWith("🔥 Someone"));

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
for (const asset of TRADABLE_ASSETS) {
  const rows = await ex.client.listLiveBinaryMarkets({
    asset,
    intervalSec: APP_CADENCE_SECONDS,
    limit: 10,
  });
  const live = rows.map(toDreamdexMarket);
  const picked = pickTradableMarket(live, NOW);
  ok(`${asset}: the venue lists a ${APP_CADENCE_SECONDS}s series`, live.length > 0,
     `(${live.length} live)`);
  ok(`${asset}: every row is the asset and cadence asked for`,
     live.every((m) => m.asset === asset && Math.abs(m.windowSeconds - APP_CADENCE_SECONDS) <= 5));
  if (picked) {
    const q = quoteFromProbability(picked.lastProbability);
    ok(`${asset}: picked window is open and has room to bet`,
       isTrading(picked, NOW) && picked.expiry - NOW/1000 >= 5);
    console.log(`   ${asset} quote: ${(q.upProbability*100).toFixed(1)}% UP` +
      `  ${q.payoutUp.toFixed(2)}x / ${q.payoutDown.toFixed(2)}x` +
      `  ${q.isIndicative ? "(indicative, untraded)" : `(${picked.tradeCount} trades, vol ${picked.volume})`}` +
      `  ${Math.round(picked.expiry - NOW/1000)}s left`);
  } else {
    console.log(`   ${asset}: no window currently open (between rolls)`);
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
  ok(`${asset}: reference window exposes a posted opening price`,
     picked.mode !== "reference" || boundary !== null, `boundary=${boundary}`);

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

  ok(`${asset}: the 1m series yields an hour of prints`, pts.length >= 50, `${pts.length} points`);
  ok(`${asset}: prints land exactly one minute apart`,
     gaps.every((g) => g === PRICE_SERIES_CADENCE_SECONDS), `gaps: ${gaps.join(",")}`);
  ok(`${asset}: the freshest print is under two minutes old`,
     NOW/1000 - pts[pts.length-1].t < 120, `${Math.round(NOW/1000 - pts[pts.length-1].t)}s`);
}

// --- the verdict: read off the contract, and it matches the prices ---
const settled = await ex.client.listPastBinaryMarkets({ asset: "BTC", intervalSec: APP_CADENCE_SECONDS, limit: 6 });
const sIds = settled.map((m) => m.marketId);
const [opens, closes] = await Promise.all([
  ex.client.getOpeningPrices(sIds),
  ex.client.getResolutionPrices(sIds),
]);
let checkedVerdicts = 0;
for (const raw of settled) {
  const m = toDreamdexMarket(raw);
  const dir = resolvedDirection(m);
  const o = opens[m.marketId.toLowerCase()];
  const c = closes[m.marketId.toLowerCase()];
  if (dir === null || o === null || c === null || o === undefined || c === undefined) continue;
  checkedVerdicts++;
  // "closes at or above its opening price" — outcome 0 (YES) must mean UP.
  ok(`settled window: contract verdict matches open vs close`,
     dir === (Number(c) >= Number(o) ? "up" : "down"),
     `${dir} open=${o} close=${c} winningOutcome=${m.winningOutcome}`);
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
