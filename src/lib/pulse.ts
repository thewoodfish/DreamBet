import type { Direction } from "@/lib/round";
import { formatDuration } from "@/lib/format";

/**
 * The market pulse: what is actually happening in this window, read off data
 * the app already has.
 *
 * Everything here is arithmetic on real numbers — oracle prints, contract
 * verdicts, the resting book, recorded bets. Nothing is predicted and nothing
 * is advised: the panel says where the price sits relative to the line and how
 * much this asset normally moves, and leaves the conclusion to the player. That
 * is both the honest framing and the only one that cannot be wrong.
 */

/** How a past window closed. A void is neither side winning. */
export type WindowOutcome = "up" | "down" | "void";

/** Bets from this player's group on the window currently open. */
export interface GroupTally {
  up: number;
  down: number;
  upStake: number;
  downStake: number;
  /** Whether these are the group's bets or everyone's. */
  scope: "group" | "global";
}

/** What the resting book looks like, in the terms a player cares about. */
export interface BookDepth {
  /** Resting orders that would sell you UP, and DOWN. */
  upOffers: number;
  downOffers: number;
  /** Outcome tokens resting on each side. */
  upSize: number;
  downSize: number;
}

export interface PulseInput {
  symbol: string;
  /** Latest oracle print. */
  price: number | null;
  /** The line this window settles against, null before the opening print lands. */
  boundary: number | null;
  /** The last hour of 1-minute prints, oldest first. */
  history: number[];
  secondsLeft: number;
  /** Previous windows on this cadence, newest first. */
  recent: WindowOutcome[];
  /** Book-implied probability UP resolves true, or null if it has never traded. */
  upProbability: number | null;
  book: BookDepth | null;
  group: GroupTally | null;
}

export type Closeness = "unknown" | "coin-flip" | "leaning" | "clear";

export interface Pulse {
  /** Signed percentage the price sits above (+) or below (−) the line. */
  distancePct: number | null;
  /** Typical size of a one-minute move for this asset, as a percentage. */
  typicalMovePct: number | null;
  /** The line's distance expressed in minutes of typical movement. */
  minutesOfMovement: number | null;
  /**
   * The line's distance as a fraction of the window's remaining reach, signed
   * towards whichever side is ahead. 1 is the edge of what the price normally
   * covers in the time left; negative means DOWN is the side in front.
   */
  reach: number | null;
  /** Which side is currently winning, if the line is known. */
  leader: Direction | null;
  closeness: Closeness;
  /** Consecutive windows at the front of `recent` that closed the same way. */
  streak: { side: Direction; length: number } | null;
  /** One or two sentences describing the above. */
  sentence: string;
}

/**
 * The typical size of a one-minute move, as a percentage.
 *
 * The median rather than the mean: a single spike in an hour of prints drags a
 * mean far enough to make every window afterwards look calm by comparison, and
 * "typical" is exactly the thing a mean stops describing when that happens.
 *
 * Unchanged prints are dropped rather than counted as zero-sized moves. At two
 * decimal places on a five-figure price, a repeat is the oracle publishing the
 * same answer again — missing data, not an observation that the price held
 * still — and when a feed stalls those repeats are the majority, which is
 * exactly where a median that counted them would report no movement at all.
 * Dropping them leaves the median describing the minutes that were actually
 * measured, and leaves a wholly stalled feed reporting nothing, which is the
 * truth about it.
 */
export function typicalMovePct(history: number[]): number | null {
  const moves: number[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const from = history[i - 1];
    if (from <= 0) continue;
    const move = Math.abs((history[i] - from) / from) * 100;
    if (move > 0) moves.push(move);
  }
  if (moves.length === 0) return null;

  moves.sort((a, b) => a - b);
  const mid = Math.floor(moves.length / 2);
  const median =
    moves.length % 2 === 0 ? (moves[mid - 1] + moves[mid]) / 2 : moves[mid];

  // An asset that has genuinely not moved all hour would make every ratio
  // below infinite. Treated as unknown rather than as infinite certainty.
  return median > 0 ? median : null;
}

/** Signed percentage between the live price and the line it settles against. */
export function distancePct(
  price: number | null,
  boundary: number | null
): number | null {
  if (price === null || boundary === null || boundary <= 0) return null;
  return ((price - boundary) / boundary) * 100;
}

/**
 * How far the line is, in minutes of ordinary movement for this asset.
 *
 * Deliberately linear — distance divided by a typical minute — rather than the
 * square-root scaling a random walk would give. Linear understates how far
 * away a line really is, so it errs towards calling a window close, which is
 * the safe direction to be wrong in when somebody is about to bet on it.
 */
export function minutesOfMovement(
  distance: number | null,
  typical: number | null
): number | null {
  if (distance === null || typical === null || typical <= 0) return null;
  return Math.abs(distance) / typical;
}

/**
 * How far the line is as a fraction of how far the price can still travel.
 *
 * This one number is the whole panel: 0.05% means nothing on its own, and means
 * a great deal once you know the asset covers that in a minute and the window
 * has nine of them to run. Below 1 the line is inside the window's reach; above
 * it, the price would have to move unusually hard to get back.
 */
export function reachRatio(
  minutes: number | null,
  secondsLeft: number
): number | null {
  if (minutes === null || secondsLeft <= 0) return null;
  const minutesLeft = secondsLeft / 60;
  if (minutesLeft <= 0) return null;
  return minutes / minutesLeft;
}

/** Where a reach ratio falls, in the words the panel puts on it. */
export function classifyReach(ratio: number | null): Closeness {
  if (ratio === null) return "unknown";
  if (ratio <= COIN_FLIP_REACH) return "coin-flip";
  if (ratio <= 1) return "leaning";
  return "clear";
}

/**
 * Inside this fraction of the window's reach, the line is close enough that
 * calling either side would be inventing confidence. Drawn as the bright core
 * of the reach track, so the words and the picture cannot disagree.
 */
export const COIN_FLIP_REACH = 0.35;

/** Whether the line is within reach in the time that is left. */
export function closeness(
  minutes: number | null,
  secondsLeft: number
): Closeness {
  return classifyReach(reachRatio(minutes, secondsLeft));
}

/**
 * How many windows in a row have just closed the same way.
 *
 * A void breaks the run rather than continuing or ending it on a side, because
 * a voided window is not evidence of anything.
 */
export function outcomeStreak(
  recent: WindowOutcome[]
): { side: Direction; length: number } | null {
  const first = recent[0];
  if (first === undefined || first === "void") return null;

  let length = 1;
  while (recent[length] === first) length += 1;
  return { side: first, length };
}

/**
 * A percentage as a number, at a precision that shows the value instead of
 * rounding it away — these moves are routinely hundredths of a percent, and
 * two decimal places turns most of them into "0.00%".
 */
export function formatPctValue(value: number): string {
  const abs = Math.abs(value);
  const dp = abs < 0.1 ? 3 : abs < 1 ? 2 : 1;
  return `${abs.toFixed(dp)}%`;
}

/** A percentage in prose, where a vanishing number reads better than a zero. */
export function formatMovePct(value: number): string {
  const abs = Math.abs(value);
  if (abs < 0.005) return "under 0.01%";
  return `${abs.toFixed(abs < 1 ? 2 : 1)}%`;
}

/**
 * "under a minute" / "about a minute" / "about 4 minutes" / "over an hour".
 *
 * Capped at the top because the figure stops being informative long before it
 * stops being computable: a line ninety minutes of movement away and a line
 * nine hours away mean the same thing to somebody with a minute left, and only
 * one of them sounds like a real sentence.
 */
function minutesPhrase(minutes: number): string {
  if (minutes < 0.75) return "under a minute";
  if (minutes < 1.5) return "about a minute";
  if (minutes > 60) return "over an hour";
  return `about ${Math.round(minutes)} minutes`;
}

/**
 * Read every number at once, and say what they add up to.
 *
 * The sentence is built from clauses rather than picked from a list of canned
 * lines, so it stays true to whichever facts happen to exist — an unposted
 * line, an untraded book and a five-window streak are all ordinary states here,
 * and each changes what there is to say.
 */
export function readPulse(input: PulseInput): Pulse {
  const distance = distancePct(input.price, input.boundary);
  const typical = typicalMovePct(input.history);
  const minutes = minutesOfMovement(distance, typical);
  const ratio = reachRatio(minutes, input.secondsLeft);
  const how = classifyReach(ratio);
  const streak = outcomeStreak(input.recent);
  const leader = distance === null ? null : distance >= 0 ? "up" : "down";

  return {
    distancePct: distance,
    typicalMovePct: typical,
    minutesOfMovement: minutes,
    reach: ratio === null ? null : leader === "down" ? -ratio : ratio,
    leader,
    closeness: how,
    streak,
    sentence: sentenceFor(input, { distance, minutes, how, streak, leader }),
  };
}

function sentenceFor(
  input: PulseInput,
  read: {
    distance: number | null;
    minutes: number | null;
    how: Closeness;
    streak: { side: Direction; length: number } | null;
    leader: Direction | null;
  }
): string {
  const clauses: string[] = [];

  if (read.distance === null || read.leader === null) {
    // No line yet is a real state in the first seconds of a window, and saying
    // so beats inventing a position relative to a number that does not exist.
    clauses.push(
      `${input.symbol} has no line posted yet — the opening price is still landing.`
    );
  } else {
    const side = read.leader === "up" ? "above" : "below";
    const where = `${input.symbol} is ${formatMovePct(read.distance)} ${side} the line`;

    if (read.how === "unknown" || read.minutes === null) {
      clauses.push(`${where}.`);
    } else if (read.how === "coin-flip") {
      clauses.push(
        `${where} — ${minutesPhrase(read.minutes)} of typical movement, with ${formatDuration(input.secondsLeft)} still to run. Too close to call.`
      );
    } else if (read.how === "leaning") {
      clauses.push(
        `${where}, which is ${minutesPhrase(read.minutes)} of movement — ${read.leader === "up" ? "UP" : "DOWN"} is ahead, but the line is still in reach.`
      );
    } else {
      clauses.push(
        `${where} — ${minutesPhrase(read.minutes)} of movement with only ${formatDuration(input.secondsLeft)} left, so ${read.leader === "up" ? "UP" : "DOWN"} is well clear.`
      );
    }
  }

  // One supporting fact, not three, in the order they matter.
  //
  // A run of voids leads, because it is the only one that changes what betting
  // here means: a window that settles as a void pays nobody and hands the
  // stake back, and this venue does it in stretches — seven 5-minute windows
  // in a row on the afternoon this was written. Six grey marks in the strip
  // with nothing to explain them is the panel showing a fact and withholding
  // its meaning.
  const voids = input.recent.filter((o) => o === "void").length;

  if (voids >= 3 && voids * 2 >= input.recent.length) {
    clauses.push(
      `${voids} of the last ${input.recent.length} windows on this cadence settled as voids — stakes returned, nobody paid out.`
    );
  } else if (read.streak && read.streak.length >= 3) {
    clauses.push(
      `The last ${read.streak.length} windows all closed ${read.streak.side === "up" ? "UP" : "DOWN"}.`
    );
  } else if (input.upProbability === null) {
    clauses.push("Nothing has traded in this window yet, so the odds are indicative.");
  } else if (input.group && input.group.up + input.group.down > 0) {
    const { up, down, scope } = input.group;
    const mine = scope === "group";
    if (up === down) {
      clauses.push(
        `${mine ? "Your group is" : "Players are"} split ${up}–${down} on this window.`
      );
    } else {
      const count = Math.max(up, down);
      const side = up > down ? "UP" : "DOWN";
      clauses.push(
        mine
          ? `${count} of your group took ${side}.`
          : `${count} ${count === 1 ? "player" : "players"} took ${side}.`
      );
    }
  }

  return clauses.join(" ");
}
