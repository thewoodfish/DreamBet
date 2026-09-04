/**
 * A wallet's "user said no". EIP-1193 reserves 4001 for it, but the code is
 * carried at a different depth by every wallet, and Privy's embedded modal
 * reports its own dismissal in words — so both are checked.
 */
export function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request")
  );
}

/**
 * The wallet cannot pay for gas. Worth telling apart from every other failure,
 * because it is the one a player fixes somewhere else entirely — no amount of
 * retrying inside the app will produce the gas token.
 */
export function isOutOfGasFunds(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("insufficient funds") ||
    message.includes("exceeds the balance") ||
    message.includes("gas required exceeds")
  );
}
