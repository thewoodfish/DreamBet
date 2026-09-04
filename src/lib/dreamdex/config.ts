import { somniaMainnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { Chain } from "@somnia-chain/markets-sdk/chains";

/**
 * dreamDEX event contracts run on Somnia. Everything here was read off the live
 * deployment rather than the docs, because the two disagree in places (the
 * "indexer URL" published next to the RPC is the RPC).
 */
export interface DreamdexNetwork {
  chain: Chain;
  /** Envio/Hasura GraphQL endpoint. The SDK requires one at construction. */
  indexerUrl: string;
  /** Collateral the markets are denominated in. */
  collateral: {
    address: `0x${string}`;
    symbol: string;
    /** Mainnet USDso is 18dp, testnet tUSDC is 6dp — a 10^12 difference. */
    decimals: number;
  };
  explorerUrl: string;
}

export const NETWORKS = {
  mainnet: {
    chain: somniaMainnet,
    indexerUrl: "https://smk.somnia.host/v1/graphql",
    collateral: {
      address: "0x00000022dA000002656c64D9eA6011ea952D008A",
      symbol: "USDso",
      decimals: 18,
    },
    explorerUrl: "https://explorer.somnia.network",
  },
  testnet: {
    chain: somniaShannon,
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    collateral: {
      address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
      symbol: "tUSDC",
      decimals: 6,
    },
    explorerUrl: "https://shannon-explorer.somnia.network",
  },
} as const satisfies Record<string, DreamdexNetwork>;

export type NetworkName = keyof typeof NETWORKS;

/** Testnet by default; the hackathon markets and the faucet both live there. */
export const NETWORK_NAME: NetworkName =
  process.env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const NETWORK: DreamdexNetwork = NETWORKS[NETWORK_NAME];

/**
 * Strikes come off the indexer as integers scaled by 100 — a market whose
 * question reads "at or above 2516.23" carries `strike: "251623"`. Verified
 * across every live BTC and ETH market; it is not the collateral's decimals.
 */
export const STRIKE_SCALE = 100;

/**
 * Outcome-token prices are probabilities in (0,1) scaled to the collateral's
 * decimals: buying UP at 0.54 costs 0.54 collateral and returns 1.00 if it
 * lands, so the multiplier a punter sees is 1/price.
 */
export const PROBABILITY_ONE = 1;

/**
 * Cadences the venue actually rolls, per asset, verified against the live
 * board: 1m, 5m, 15m, 1h, 4h and 24h series all run concurrently.
 */
export const WINDOW_SECONDS = [60, 300, 900, 3600, 14400, 86400] as const;

/**
 * Cadences DreamBet will trade, in the order it wants them.
 *
 * 15m first, because it is long enough that a group has time to pile in after
 * somebody shares a bet and short enough to settle inside one sitting. But this
 * venue's market creators are intermittent — for stretches of an hour or more
 * the only series still rolling is the hourly one — and an app that trades
 * exactly one cadence is dark whenever that particular roller stops, however
 * busy the rest of the board is.
 *
 * So the preference is a list, not a constant. A live 15m window always wins;
 * failing that the app takes the next-best thing that actually exists, and says
 * plainly how long the window it found runs for.
 *
 * Matched as a band by the indexer, not exactly — trading routinely opens a
 * second or two late, so a 15m series is indexed at 898s and 899s as well.
 */
export const TRADED_CADENCES = [900, 300, 3600, 60] as const;

/** The cadence DreamBet prefers, and trades whenever the venue offers it. */
export const APP_CADENCE_SECONDS = TRADED_CADENCES[0];

/**
 * The cadence the price chart is read from. Markets on the 1-minute series are
 * created with a fixed strike, and that strike is the feed's spot at creation —
 * so a run of them is the oracle's own 1-minute price history. See
 * `oracle.ts`; nothing else about this series is used.
 */
export const PRICE_SERIES_CADENCE_SECONDS = 60;

/**
 * Event contracts exist for these assets only. The mock feed also carried SOMI,
 * which has no binary market — it can stay as a price feed but must never be
 * offered as something to bet on.
 */
export const TRADABLE_ASSETS = ["BTC", "ETH"] as const;
export type TradableAsset = (typeof TRADABLE_ASSETS)[number];

export function isTradableAsset(symbol: string): symbol is TradableAsset {
  return (TRADABLE_ASSETS as readonly string[]).includes(symbol);
}
