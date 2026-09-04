import { NETWORK, type TradableAsset } from "@/lib/dreamdex/config";

/**
 * Bound to the assets dreamDEX actually lists a binary market for, so the pill
 * row cannot drift back into offering something unbettable — the mock feed
 * carried SOMI, which has a spot price but no event contract behind it.
 */
export type AssetSymbol = TradableAsset;

/**
 * Presentation metadata only. Prices, strikes and windows all come from the
 * event contracts — nothing here influences what anything is worth.
 */
export interface Asset {
  symbol: AssetSymbol;
  /** Display pair, e.g. "BTC/tUSDso". Names the collateral actually settled in. */
  pair: string;
  name: string;
  /** Decimal places used when rendering the price. */
  decimals: number;
}

const ASSET_META: Omit<Asset, "pair">[] = [
  { symbol: "BTC", name: "Bitcoin", decimals: 2 },
  { symbol: "ETH", name: "Ethereum", decimals: 2 },
  { symbol: "SOL", name: "Solana", decimals: 2 },
];

export const ASSETS: Asset[] = ASSET_META.map((asset) => ({
  ...asset,
  // The quote side is whatever this network settles in — tUSDC on testnet,
  // USDso on mainnet. Hardcoding "USDso" would mislabel every testnet pair.
  pair: `${asset.symbol}/${NETWORK.collateral.symbol}`,
}));

export const DEFAULT_ASSET = ASSETS[0].symbol;

export function getAsset(symbol: AssetSymbol): Asset {
  const asset = ASSETS.find((a) => a.symbol === symbol);
  if (!asset) throw new Error(`Unknown asset: ${symbol}`);
  return asset;
}
