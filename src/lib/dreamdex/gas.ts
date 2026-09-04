import { rawInitData } from "@/lib/telegram";

/** What the sponsor did, or why it did nothing. */
export interface GasResult {
  funded: boolean;
  /** "has-gas" and "cooldown" are fine; "unconfigured" means nobody is paying. */
  reason?: string;
}

/**
 * Make sure the player can pay for the transaction they are about to send.
 *
 * Every public STT faucet asks for a browser wallet to connect, and a Mini App
 * has none — so gas cannot be the player's problem, and this asks the app's own
 * sponsor to cover it. It is safe to call before anything: the server sends
 * nothing to a wallet that already has gas.
 *
 * Never throws. A sponsor that is down or unconfigured must not stop a player
 * who already has gas from betting — the transaction itself is the real test,
 * and it fails with its own words if there is nothing to pay with.
 */
export async function ensureGas(address: string): Promise<GasResult> {
  try {
    const response = await fetch("/api/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Telegram's signed launch payload, which is what proves to the server
      // that this is a real session rather than a script draining the sponsor.
      body: JSON.stringify({ address, initData: rawInitData() }),
    });

    if (!response.ok) return { funded: false, reason: "failed" };
    return (await response.json()) as GasResult;
  } catch {
    return { funded: false, reason: "failed" };
  }
}
