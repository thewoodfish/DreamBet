// Emits one line whenever the set of live windows changes. Used as a Monitor
// event stream; nothing here writes to the repo.
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const ex = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
});
const APP = 900; // the cadence DreamBet trades
let previous = "";

while (true) {
  try {
    const now = Date.now();
    const open = [];
    for (const asset of ["BTC", "ETH"]) {
      for (const iv of [60, 300, 900, 3600]) {
        const rows = await ex.client
          .listLiveBinaryMarkets({ asset, intervalSec: iv, limit: 3 })
          .catch(() => []);
        const live = rows.filter(
          (m) => Number(m.expiryTs ?? m.expiry ?? 0) * 1000 - now > 5000
        );
        if (live.length) open.push(`${asset}/${iv}s`);
      }
    }

    const key = open.join(",");
    if (key !== previous) {
      const tradable = open.some((o) => o.endsWith(`/${APP}s`));
      const stamp = new Date().toISOString().slice(11, 19);
      if (tradable) {
        console.log(`${stamp} DreamBet CAN TRADE — 15m window open (${key})`);
      } else if (open.length) {
        console.log(`${stamp} venue rolling other cadences only: ${key} — app still shows Paused`);
      } else {
        console.log(`${stamp} venue went quiet — nothing open on any cadence`);
      }
      previous = key;
    }
  } catch {
    // A dropped poll is not an event; the next one re-reads the whole state.
  }
  await new Promise((r) => setTimeout(r, 45_000));
}
