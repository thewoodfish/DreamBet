import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { toDreamdexMarket, quoteFromProbability, clampProbability } from "../src/lib/dreamdex/market.ts";
import { STRIKE_SCALE } from "../src/lib/dreamdex/config.ts";

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
ok("isOpen tracks Trading status",
   mkts.every((m) => m.isOpen === (m.status === "Trading")));

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

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
