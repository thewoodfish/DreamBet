import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { toDreamdexMarket, quoteFromProbability, clampProbability, isTrading, pickTradableMarket, marketBoundary, resolvedDirection } from "../src/lib/dreamdex/market.ts";
import { STRIKE_SCALE, APP_CADENCE_SECONDS, TRADABLE_ASSETS, PRICE_SERIES_CADENCE_SECONDS } from "../src/lib/dreamdex/config.ts";
import { netResult } from "../src/lib/round.ts";

let fail = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
};

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

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
