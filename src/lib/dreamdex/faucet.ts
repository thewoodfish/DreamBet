import { createWalletClient, custom } from "viem";
import { ContractRevertError, RpcError } from "@somnia-chain/markets-sdk";
import { exchange, publicClient } from "./client";
import { NETWORK, NETWORK_NAME } from "./config";
import { isOutOfGasFunds, isUserRejection } from "./errors";
import type { DreamSigner } from "@/lib/account";

/**
 * How much a single claim mints.
 *
 * TestUSDC caps `faucet()` at 10,000 per transaction — `FAUCET_PER_TX` in the
 * deployed source — with no cooldown and no ceiling on what a wallet may hold.
 * Claiming the whole cap in one tap is therefore both the most a player can get
 * and the reason most of them never need to come back for a second.
 */
export const FAUCET_CLAIM = 10_000;

/**
 * Only the testnet collateral mints itself. Mainnet USDso has to be acquired,
 * so the button must not exist there promising something it cannot do.
 */
export const FAUCET_AVAILABLE = NETWORK_NAME === "testnet";

/**
 * Mint test collateral to the signer.
 *
 * A wallet created behind a Telegram login has no funding route of its own —
 * nobody is going to bridge into an address they have never seen — so the app
 * has to be the faucet's front end or the demo dead-ends at a zero balance.
 */
export async function claimTestCollateral(
  signer: DreamSigner
): Promise<`0x${string}`> {
  const { decimals, address: collateral } = NETWORK.collateral;

  const walletClient = createWalletClient({
    account: signer.address,
    chain: NETWORK.chain,
    transport: custom(signer.provider),
  });

  const trader = exchange.client.createTrader({
    walletClient,
    publicClient,
    decimals,
  });

  // The address is passed explicitly rather than left to the SDK's own
  // registry, so this mints the exact token the balance is read from.
  //
  // The gas ceiling is ours rather than the SDK's 10,000,000. A ceiling is not
  // a cost — the chain refunds what is not burnt — but Somnia demands the whole
  // of it on hand before it will accept the transaction, and at a flat 6 gwei
  // the SDK's default is 0.06 STT a new wallet has to be holding to mint its
  // first collateral. This call estimates at 1.38M, so 2M is headroom that
  // costs a player nothing and asks them to be holding a seventh as much.
  const { hash } = await trader.faucet({
    testUsdc: collateral,
    amount: BigInt(FAUCET_CLAIM) * 10n ** BigInt(decimals),
    gas: 2_000_000n,
  });

  return hash;
}

/**
 * Faucet failures in words a player can act on. The gas branch is the one that
 * matters: it is the only failure here whose fix is outside this app.
 */
export function faucetErrorMessage(error: unknown): string {
  if (isUserRejection(error)) {
    return "You cancelled the top-up. Nothing was claimed.";
  }

  if (isOutOfGasFunds(error)) {
    // Gas is the app's problem and stays in the app's own vocabulary: a player
    // cannot act on it and has no reason to learn what it is. All they need is
    // that this one was ours, not theirs, and that trying again is worth it.
    return "That one is on us — something went wrong on our side. Try again in a moment.";
  }

  if (error instanceof ContractRevertError) {
    if (error.errorName === "FaucetCapExceeded") {
      return `The faucet gives out ${FAUCET_CLAIM.toLocaleString()} ${NETWORK.collateral.symbol} at a time. Try again in a moment.`;
    }
    return "The faucet turned that request down. Try again.";
  }

  if (error instanceof RpcError) {
    return "Somnia didn't answer. Check your connection and try again.";
  }

  return "Couldn't top up your test balance. Try again.";
}
