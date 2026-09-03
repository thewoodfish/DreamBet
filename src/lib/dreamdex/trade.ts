import { createWalletClient, custom } from "viem";
import { ORDER_TYPE, ContractRevertError, RpcError } from "@somnia-chain/markets-sdk";
import type { PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { exchange, publicClient } from "./client";
import { NETWORK } from "./config";
import { descale, type StakeQuote } from "./book";
import type { DreamSigner } from "@/lib/account";

export interface PlaceBetParams {
  /** The signed-in wallet — Privy's embedded one, normally. */
  signer: DreamSigner;
  /** BinaryPool the window's orders are placed against. */
  pool: `0x${string}`;
  quote: StakeQuote;
  decimals: number;
}

/** What the order actually did, read back off its own fills. */
export interface BetFill {
  /** Outcome tokens the order really got — the gross return if this side wins. */
  shares: number;
  /** Collateral really spent. */
  cost: number;
  /** `shares / cost`, from the fills rather than from the quote. */
  payoutMultiplier: number;
  hash: `0x${string}`;
}

/**
 * Place the bet as a market order against the resting book.
 *
 * `ORDER_TYPE.MARKET` is an IOC: it crosses whatever it can right now at the
 * protective limit the quote worked out, and cancels the rest rather than
 * leaving a stub resting on the book. That matches what the ticket promises —
 * a bet that either exists the moment you tap or does not exist at all — and it
 * means the user is never left with an order quietly waiting to be filled after
 * the window they were betting on has closed.
 *
 * The escrowed collateral is approved to the pool automatically when the
 * allowance is short, so a first-time player does not have to know what an
 * approval is.
 */
export async function placeBet({
  signer,
  pool,
  quote,
  decimals,
}: PlaceBetParams): Promise<BetFill> {
  const walletClient = createWalletClient({
    account: signer.address,
    chain: NETWORK.chain,
    transport: custom(signer.provider),
  });

  // Reads (allowance, receipt) go through the app's own batching client rather
  // than the wallet's provider, which is a relay to whatever node Privy picked.
  const trader = exchange.client.createTrader({
    walletClient,
    publicClient,
    decimals,
  });

  const result = await trader.placeOrder({
    pool,
    side: quote.side,
    price: quote.order.yesPrice,
    quantity: quote.order.quantity,
    orderType: ORDER_TYPE.MARKET,
  });

  return fillOf(result, quote, decimals);
}

/**
 * What the transaction actually bought, from the fills it emitted — not from
 * the quote that preceded it. A market order crosses a book that anyone else
 * can move in the meantime, so the two disagree often enough that recording the
 * quote would be recording a promise instead of a position.
 *
 * Fill prices are always quoted in YES terms, so a DOWN bet pays the inverse of
 * the printed price: buying NO at 0.40 means the YES side printed 0.60.
 */
export function fillOf(
  result: PlaceOrderResult,
  quote: StakeQuote,
  decimals: number
): BetFill {
  const one = 10n ** BigInt(decimals);
  let quantity = 0n;
  let spent = 0n;

  for (const fill of result.fills) {
    const paid = quote.side === "BUY_YES" ? fill.fillPrice : one - fill.fillPrice;
    quantity += fill.quantityFilled;
    spent += (fill.quantityFilled * paid) / one;
  }

  // An IOC that crossed nothing is not a bet. It happens when the book empties
  // between the quote and the block, and it must surface as "no bet placed"
  // rather than as a position with no money behind it.
  if (quantity <= 0n || spent <= 0n) throw new EmptyFillError();

  const shares = descale(quantity, decimals);
  const cost = descale(spent, decimals);

  return {
    shares,
    cost,
    payoutMultiplier: shares / cost,
    hash: result.hash,
  };
}

/** The order landed but crossed nothing — the book moved out from under it. */
export class EmptyFillError extends Error {
  constructor() {
    super("Order filled nothing");
    this.name = "EmptyFillError";
  }
}

/**
 * Chain and wallet failures, in words a punter can act on. Every branch here
 * ends in something the user can *do*; the protocol's own error name is only
 * ever a route to that sentence, never shown.
 */
export function betErrorMessage(error: unknown): string {
  if (error instanceof EmptyFillError) {
    return "Nobody was offering that side by the time your bet landed. Nothing was staked — try again.";
  }

  if (isUserRejection(error)) {
    return "You cancelled the transaction. Nothing was staked.";
  }

  if (error instanceof ContractRevertError) {
    switch (error.errorName) {
      case "InsufficientBalance":
      case "ERC20InsufficientBalance":
        return `Not enough ${NETWORK.collateral.symbol} to cover that bet.`;
      case "OrderAlreadyExpired":
      case "OrderExpiryBeyondMarket":
      case "MarketNotTrading":
        return "That window closed before your bet landed. The next one opens shortly.";
      case "QuantityBelowMinimum":
        return "That amount is below the market's minimum. Try a larger bet.";
      default:
        return "The market rejected that bet. Nothing was staked.";
    }
  }

  if (error instanceof RpcError) {
    return "Somnia didn't answer. Check your connection and try again.";
  }

  return "Couldn't place that bet. Nothing was staked — try again.";
}

/**
 * A wallet's "user said no". EIP-1193 reserves 4001 for it, but the code is
 * carried at a different depth by every wallet, and Privy's embedded modal
 * reports its own dismissal in words — so both are checked.
 */
function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request")
  );
}
