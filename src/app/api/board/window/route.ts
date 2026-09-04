import { NextResponse } from "next/server";
import { readFront, readManyJson, storeConfigured } from "@/lib/server/store";
import { betKey, listKey } from "@/lib/server/keys";
import type { BetRecord } from "@/lib/board/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is already in the window you are looking at.
 *
 * The leaderboard answers "who is winning overall"; this answers "what is my
 * group doing right now", which is the question that makes somebody bet. Same
 * recorded bets underneath — only the slice differs, so nothing new is trusted
 * or stored to serve it.
 *
 * Deliberately a tally and never a list of names: seeing which specific friend
 * took which side turns a market into a copy button, and the point of scoring a
 * group against each other is that they each make their own call.
 */

/** Bets scanned for the market in question. Matches the leaderboard's depth. */
const PAGE = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketId = url.searchParams.get("market");
  const group = url.searchParams.get("group");

  if (!marketId) {
    return NextResponse.json({ error: "market required" }, { status: 400 });
  }

  const scope = group ? "group" : "global";
  const empty = { up: 0, down: 0, upStake: 0, downStake: 0, scope };

  if (!storeConfigured) {
    return NextResponse.json({ ...empty, unavailable: true });
  }

  const hashes = await readFront(listKey(group), PAGE);
  const bets = await readManyJson<BetRecord>(hashes.map(betKey));

  const wanted = marketId.toLowerCase();
  const tally = bets.reduce(
    (acc, bet) => {
      if (bet.marketId.toLowerCase() !== wanted) return acc;
      if (bet.side === "up") {
        acc.up += 1;
        acc.upStake += bet.stake;
      } else {
        acc.down += 1;
        acc.downStake += bet.stake;
      }
      return acc;
    },
    { ...empty }
  );

  return NextResponse.json({ ...tally, unavailable: false });
}
