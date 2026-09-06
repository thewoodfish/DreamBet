import { NextResponse } from "next/server";
import { publicClient } from "@/lib/dreamdex/client";
import { isTradableAsset } from "@/lib/dreamdex/config";
import { verifyTelegram, telegramAuthConfigured } from "@/lib/server/telegram";
import {
  pushFront,
  readFront,
  readManyJson,
  storeConfigured,
  trim,
  writeJson,
} from "@/lib/server/store";
import { betKey, listKey } from "@/lib/server/keys";
import { settledFactsFor } from "@/lib/server/verdicts";
import type { BetRecord, Verdict } from "@/lib/board/types";
import { bestStreakOf, betNet, streakOf } from "@/lib/leaderboard";
import type { LeaderboardEntry } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The standings.
 *
 * Private rounds are social, not on-chain. Everybody bets into the same public
 * dreamDEX window — that is where the liquidity is, and a market invented for
 * five friends would have nobody on the other side of it — and this scores the
 * bets that came from one Telegram group against each other. Same market
 * underneath, private competition on top.
 *
 * Nothing here is taken on the player's word. A bet is written only if the
 * chain confirms that exact transaction was sent by that exact address, and the
 * result is never stored at all: outcomes are read back off the market when the
 * table is built, so the one thing worth lying about cannot be sent at all.
 */

/** Rows kept per scope. Deep enough for a leaderboard, shallow enough to read
    in one round trip. */
const KEEP = 300;

/** Bets pulled into one table. */
const PAGE = 200;

export async function POST(request: Request) {
  if (!storeConfigured) {
    return NextResponse.json({ recorded: false, reason: "unconfigured" });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ recorded: false, reason: "bad-request" }, { status: 400 });
  }

  // Same gate as the gas sponsor: where a bot token is configured, only real
  // Telegram sessions may write. Without one there is nothing to check against,
  // and the receipt check below is doing the real work anyway.
  if (telegramAuthConfigured && !verifyTelegram(body.initData as string)) {
    return NextResponse.json({ recorded: false, reason: "unverified" }, { status: 403 });
  }

  const hash = typeof body.hash === "string" ? body.hash : null;
  const address = typeof body.address === "string" ? body.address : null;
  const marketId = typeof body.marketId === "string" ? body.marketId : null;
  const side = body.side === "up" || body.side === "down" ? body.side : null;

  if (!hash || !address || !marketId || !side) {
    return NextResponse.json({ recorded: false, reason: "bad-request" }, { status: 400 });
  }

  // The claim is checked against the chain rather than believed. Without this
  // the table is a form anyone can fill in.
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: hash as `0x${string}`,
    });

    if (
      receipt.status !== "success" ||
      receipt.from.toLowerCase() !== address.toLowerCase()
    ) {
      return NextResponse.json({ recorded: false, reason: "unproven" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ recorded: false, reason: "unproven" }, { status: 403 });
  }

  const record: BetRecord = {
    address: address.toLowerCase(),
    handle: typeof body.handle === "string" ? body.handle.slice(0, 32) : null,
    marketId: marketId.toLowerCase(),
    // Written down rather than looked up later. Only assets this app trades are
    // accepted, so a forged one cannot reach a history row and pick the icon it
    // renders with; anything else falls back to the market's own answer.
    symbol:
      typeof body.symbol === "string" && isTradableAsset(body.symbol)
        ? body.symbol
        : undefined,
    side,
    stake: Number(body.stake) || 0,
    shares: Number(body.shares) || 0,
    hash: hash.toLowerCase(),
    ts: Date.now(),
  };

  const group =
    typeof body.chatInstance === "string" && body.chatInstance
      ? body.chatInstance.slice(0, 64)
      : null;

  // The bet itself is stored once and indexed into every table it belongs to,
  // so a group's standings and the global ones cannot disagree about it.
  await writeJson(betKey(record.hash), record);
  await pushFront(listKey(null), record.hash);
  await trim(listKey(null), KEEP);
  if (group) {
    await pushFront(listKey(group), record.hash);
    await trim(listKey(group), KEEP);
  }

  return NextResponse.json({ recorded: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "group" ? "group" : "global";
  const group = url.searchParams.get("group");
  const me = url.searchParams.get("me");

  if (!storeConfigured) {
    return NextResponse.json({ rows: [], unavailable: true });
  }

  // "This group" without a group is nobody's standings, not everybody's.
  if (scope === "group" && !group) {
    return NextResponse.json({ rows: [], unavailable: false });
  }

  const hashes = await readFront(listKey(scope === "group" ? group : null), PAGE);
  const bets = await readManyJson<BetRecord>(hashes.map(betKey));

  const facts = await settledFactsFor([
    ...new Set(bets.map((b) => b.marketId)),
  ]);
  const verdicts = new Map(
    [...facts].map(([id, fact]) => [id, fact.verdict] as const)
  );

  return NextResponse.json({
    rows: rank(bets, verdicts, me?.toLowerCase() ?? null),
    unavailable: false,
  });
}

/**
 * Bets into standings.
 *
 * A win returns the shares bought and costs the stake; a loss costs the stake;
 * a void costs nothing, because nobody was wrong. Unsettled bets are left out
 * entirely — a position still running is not a result.
 */
function rank(
  bets: BetRecord[],
  verdicts: Map<string, Verdict>,
  me: string | null
): LeaderboardEntry[] {
  interface Tally {
    address: string;
    handle: string | null;
    netPnl: number;
    settled: number;
    wins: number;
    /** Newest first, so the streak reads off the front. */
    results: boolean[];
  }

  const tallies = new Map<string, Tally>();

  for (const bet of bets) {
    const tally = tallies.get(bet.address) ?? {
      address: bet.address,
      handle: bet.handle,
      netPnl: 0,
      settled: 0,
      wins: 0,
      results: [],
    };
    // The most recent handle wins: people rename themselves.
    tally.handle = tally.handle ?? bet.handle;

    const verdict = verdicts.get(bet.marketId);
    if (verdict) {
      tally.netPnl += betNet(bet, verdict);
      // A void is not a round anybody played, so it counts towards neither the
      // win rate nor the streak.
      if (verdict !== "void") {
        const won = verdict === bet.side;
        tally.settled += 1;
        tally.wins += won ? 1 : 0;
        tally.results.push(won);
      }
    }

    tallies.set(bet.address, tally);
  }

  return [...tallies.values()]
    .sort((a, b) => b.netPnl - a.netPnl)
    .map((t, i) => ({
      rank: i + 1,
      name: t.handle ?? `${t.address.slice(0, 6)}…${t.address.slice(-4)}`,
      handle: t.handle ?? undefined,
      address: t.address,
      netPnl: t.netPnl,
      winRate: t.settled ? t.wins / t.settled : 0,
      streak: streakOf(t.results),
      bestStreak: bestStreakOf(t.results),
      rounds: t.settled,
      isYou: me !== null && t.address === me,
    }));
}
