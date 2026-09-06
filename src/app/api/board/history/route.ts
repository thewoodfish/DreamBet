import { NextResponse } from "next/server";
import { readFront, readManyJson, storeConfigured } from "@/lib/server/store";
import { betKey, listKey } from "@/lib/server/keys";
import { settledFactsFor } from "@/lib/server/verdicts";
import { betNet } from "@/lib/leaderboard";
import type { BetRecord } from "@/lib/board/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One player's own settled bets — the receipts behind the figures on the strip.
 *
 * The record sheet showed the real streak above a list of invented rounds,
 * which is the worst of both: the numbers were true and the evidence for them
 * was fiction. Same bets the standings score, sliced to one address.
 *
 * Unsettled bets are left out rather than shown as pending. A window still
 * running has no result to report, and the tiles above this list count settled
 * rounds only — a list that disagreed with them would be a bug report in the
 * shape of a feature.
 */

/** Bets scanned. Matches the leaderboard's depth, since it reads the same list. */
const PAGE = 200;

/** Rows returned. A record sheet is scrolled, not paged. */
const KEEP = 40;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const me = url.searchParams.get("me");

  if (!me) {
    return NextResponse.json({ error: "me required" }, { status: 400 });
  }
  if (!storeConfigured) {
    return NextResponse.json({ rows: [], unavailable: true });
  }

  const hashes = await readFront(listKey(null), PAGE);
  const bets = await readManyJson<BetRecord>(hashes.map(betKey));

  const wanted = me.toLowerCase();
  const mine = bets.filter((b) => b.address.toLowerCase() === wanted);

  const facts = await settledFactsFor([
    ...new Set(mine.map((b) => b.marketId)),
  ]);

  const rows = mine
    .map((bet) => {
      const fact = facts.get(bet.marketId);
      // Still running. Not a result yet, so not a row yet.
      if (!fact) return null;

      const voided = fact.verdict === "void";
      return {
        id: bet.hash,
        // The record's own symbol where it has one, the market's where it does
        // not — older records predate the field.
        symbol: bet.symbol ?? fact.asset,
        direction: bet.side,
        stake: bet.stake,
        won: !voided && fact.verdict === bet.side,
        voided,
        net: betNet(bet, fact.verdict),
        ts: bet.ts,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, KEEP);

  return NextResponse.json({ rows, unavailable: false });
}
