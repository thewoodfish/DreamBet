import { createPublicClient, http, type PublicClient } from "viem";
import { NETWORK } from "./config";

/**
 * Read-only view of Somnia. Reads (balances, market state) go through this
 * regardless of who — if anyone — is logged in; writes go through the wallet's
 * own provider, which Privy supplies per session.
 *
 * Somnia mines at ~100ms, so multicall batching is worth more here than
 * anywhere: a screen's worth of reads collapses into one round trip instead of
 * a dozen racing requests against the same public RPC.
 */
export const publicClient: PublicClient = createPublicClient({
  chain: NETWORK.chain,
  transport: http(),
  batch: { multicall: true },
});
