/**
 * Leaderboard shapes are deliberately source-agnostic: the same row can be
 * filled from indexed on-chain settlement events, from a backend, or from the
 * mocks below. `address` is the join key to chain data; `name`/`handle` come
 * from Telegram identity once Step 3 links the two.
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  handle?: string;
  address: string;
  /** Net collateral across the scoped period. */
  netPnl: number;
  /** 0–1. */
  winRate: number;
  streak: number;
  /** Longest run of wins on record. Absent on rows from before the server sent it. */
  bestStreak?: number;
  /** Settled bets behind the figures above. Voids are not rounds anybody played. */
  rounds?: number;
  isYou: boolean;
}

/**
 * `group` needs Telegram's chat_instance, which only exists when the Mini App
 * is launched from a group chat — opened from the bot's DM it must fall back
 * to `global`.
 */
export type LeaderboardScope = "group" | "global";

export const SCOPE_LABELS: Record<LeaderboardScope, string> = {
  group: "This group",
  global: "Global",
};

/** Deterministic avatar tint, so a given player looks the same everywhere. */
const AVATAR_TINTS = [
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-fuchsia-400 to-pink-600",
];

export function avatarTint(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

/**
 * What one settled bet was worth, in collateral.
 *
 * A win returns the outcome tokens bought and costs the stake; a loss costs the
 * stake; a void costs nothing, because nobody was wrong. Shared by the
 * standings and the history so the same bet can never be worth two different
 * numbers on two screens.
 */
export function betNet(
  bet: { side: string; stake: number; shares: number },
  verdict: "up" | "down" | "void"
): number {
  if (verdict === "void") return 0;
  return verdict === bet.side ? bet.shares - bet.stake : -bet.stake;
}

/**
 * Consecutive wins ending at the most recent settled bet, which is what a
 * streak is. Results come newest-first, so it reads off the front.
 */
export function streakOf(results: boolean[]): number {
  let streak = 0;
  for (const won of results) {
    if (!won) break;
    streak += 1;
  }
  return streak;
}

/** The longest run of wins anywhere in the record — the one worth bragging about. */
export function bestStreakOf(results: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const won of results) {
    run = won ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export function initials(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
}

/* --- Mock standings. Replaced by indexed settlement events. --- */

const GROUP: LeaderboardEntry[] = [
  { rank: 1, name: "kelechi",  handle: "@kelechi",  address: "0x91Ab…3d1", netPnl: 1284.5, winRate: 0.79, streak: 9, isYou: false },
  { rank: 2, name: "amara",    handle: "@amara_x",  address: "0x44Cd…9f2", netPnl: 962.0,  winRate: 0.74, streak: 3, isYou: false },
  { rank: 3, name: "tobi",     handle: "@tobidev",  address: "0x7bE1…0a4", netPnl: 731.25, winRate: 0.71, streak: 5, isYou: false },
  { rank: 4, name: "zara",     handle: "@zaraaa",   address: "0x2fD9…7c8", netPnl: 508.4,  winRate: 0.69, streak: 2, isYou: false },
  { rank: 5, name: "ify",      handle: "@ifynwosu", address: "0x88Aa…1b5", netPnl: 402.15, winRate: 0.66, streak: 4, isYou: false },
  { rank: 6, name: "dami",     handle: "@damiola",  address: "0x5c30…e77", netPnl: 288.0,  winRate: 0.64, streak: 1, isYou: false },
  { rank: 7, name: "nnamdi",   handle: "@nnamdi",   address: "0xA1f4…22c", netPnl: 176.8,  winRate: 0.61, streak: 0, isYou: false },
  { rank: 8, name: "chidi",    handle: "@chidi_eth",address: "0x63Bb…508", netPnl: 94.5,   winRate: 0.58, streak: 2, isYou: false },
  { rank: 9, name: "You",      handle: "@you",      address: "0x7A3f…6a5E", netPnl: 62.9,  winRate: 0.68, streak: 4, isYou: true  },
];

const GLOBAL: LeaderboardEntry[] = [
  { rank: 1, name: "somnia_whale", handle: "@somniawhale", address: "0xF0e2…aa1", netPnl: 18420.0, winRate: 0.82, streak: 14, isYou: false },
  { rank: 2, name: "candlelord",   handle: "@candlelord",  address: "0x3Ac8…b09", netPnl: 12905.5, winRate: 0.77, streak: 6,  isYou: false },
  { rank: 3, name: "0xmoon",       handle: "@zeroxmoon",   address: "0x9d17…4e3", netPnl: 9640.25, winRate: 0.75, streak: 8,  isYou: false },
  { rank: 4, name: "kelechi",      handle: "@kelechi",     address: "0x91Ab…3d1", netPnl: 7211.0,  winRate: 0.79, streak: 9,  isYou: false },
  { rank: 5, name: "sniper",       handle: "@sniper15m",   address: "0x1B44…c60", netPnl: 5088.6,  winRate: 0.70, streak: 1,  isYou: false },
  { rank: 6, name: "amara",        handle: "@amara_x",     address: "0x44Cd…9f2", netPnl: 3902.0,  winRate: 0.74, streak: 3,  isYou: false },
  { rank: 7, name: "tobi",         handle: "@tobidev",     address: "0x7bE1…0a4", netPnl: 2740.75, winRate: 0.71, streak: 5,  isYou: false },
  { rank: 8, name: "vee",          handle: "@veeonchain",  address: "0xE5c1…37f", netPnl: 1985.3,  winRate: 0.67, streak: 2,  isYou: false },
  { rank: 412, name: "You",        handle: "@you",         address: "0x7A3f…6a5E", netPnl: 62.9,  winRate: 0.68, streak: 4,  isYou: true },
];

export const MOCK_LEADERBOARD: Record<LeaderboardScope, LeaderboardEntry[]> = {
  group: GROUP,
  global: GLOBAL,
};
