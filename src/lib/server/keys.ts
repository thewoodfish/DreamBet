/**
 * Key names for the standings store.
 *
 * Shared rather than local to one route because two endpoints now read the same
 * lists — the leaderboard and the per-window tally the market pulse shows — and
 * a second copy of `board:group:${group}` in another file is a rename waiting
 * to silently split the data in half.
 */

export const betKey = (hash: string) => `bet:${hash.toLowerCase()}`;

export const verdictKey = (marketId: string) =>
  `verdict:${marketId.toLowerCase()}`;

export const listKey = (group: string | null) =>
  group ? `board:group:${group}` : "board:global";
