import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createWalletClient, formatEther, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "@/lib/dreamdex/client";
import { NETWORK, NETWORK_NAME } from "@/lib/dreamdex/config";

/** Holds a private key, so it must never be prerendered or cached. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gas, sponsored.
 *
 * A wallet minted behind a Telegram login cannot buy its own gas: every public
 * STT faucet wants a browser wallet to connect, and there is no browser wallet
 * in a Mini App — that is the entire reason the embedded one exists. So the app
 * pays. One funded key underwrites every player's first transactions, which is
 * the only arrangement where "log in and bet" is actually two taps.
 *
 * Deliberately gas only. Collateral is minted by the player's own wallet from
 * TestUSDC's public faucet, so this key never touches the money being bet with,
 * and the worst a drained sponsor can do is stop new players starting.
 */

/** STT sent to a player who has none. ~3 bets and a collateral claim at 6 gwei. */
const DRIP = parseEther(process.env.GAS_SPONSOR_DRIP_STT ?? "0.06");

/** Below this a wallet is treated as empty. Half a drip — roughly one bet left. */
const TOP_UP_BELOW = DRIP / 2n;

/** How often one address may be topped up, whatever it claims to be. */
const COOLDOWN_MS = 60_000;

/** Address -> last drip. Resets on redeploy; the balance check is the real cap. */
const lastFunded = new Map<string, number>();

/**
 * Sends are serialised through this. Two requests reading the same nonce is not
 * hypothetical on a chain that mines in 100ms — the second would be discarded,
 * and a player would be told they were funded when they were not.
 */
let queue: Promise<unknown> = Promise.resolve();

function sponsor() {
  const key = process.env.GAS_SPONSOR_PRIVATE_KEY;
  if (!key) return null;

  const account = privateKeyToAccount(
    (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`
  );

  return {
    account,
    wallet: createWalletClient({
      account,
      chain: NETWORK.chain,
      transport: http(),
    }),
  };
}

/**
 * Reports whether sponsorship is on, and which address is paying for it — so
 * the wallet it runs on can be topped up before it strands anybody, and the
 * client can tell "no gas yet" from "nobody is paying for gas here".
 */
export async function GET() {
  const paying = sponsor();
  if (!paying) return NextResponse.json({ configured: false });

  const balance = await publicClient
    .getBalance({ address: paying.account.address })
    .catch(() => null);

  return NextResponse.json({
    configured: true,
    address: paying.account.address,
    balance: balance === null ? null : formatEther(balance),
    drip: formatEther(DRIP),
    /** Players still fundable from what is left, give or take. */
    remaining: balance === null ? null : Number(balance / DRIP),
  });
}

export async function POST(request: Request) {
  // Mainnet gas is real money. This exists to make a testnet demo playable and
  // must not quietly become a way to drain a live wallet.
  if (NETWORK_NAME !== "testnet") {
    return NextResponse.json(
      { funded: false, reason: "unavailable" },
      { status: 404 }
    );
  }

  const paying = sponsor();
  if (!paying) {
    return NextResponse.json({ funded: false, reason: "unconfigured" });
  }

  let body: { address?: string; initData?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { funded: false, reason: "bad-request" },
      { status: 400 }
    );
  }

  const address = body.address;
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { funded: false, reason: "bad-request" },
      { status: 400 }
    );
  }

  // Where a bot token is configured, only real Telegram sessions are funded —
  // the signature is Telegram's own, over launch data this app never mints. In
  // local preview there is no token and no signature to check, so the balance
  // ceiling and the cooldown below are the whole of the defence.
  if (process.env.TELEGRAM_BOT_TOKEN && !fromTelegram(body.initData)) {
    return NextResponse.json(
      { funded: false, reason: "unverified" },
      { status: 403 }
    );
  }

  const key = address.toLowerCase();
  const since = Date.now() - (lastFunded.get(key) ?? 0);
  if (since < COOLDOWN_MS) {
    return NextResponse.json({ funded: false, reason: "cooldown" });
  }

  try {
    const balance = await publicClient.getBalance({ address });

    // The ceiling, not the cooldown, is what makes this safe to leave open: a
    // wallet that already has gas is never sent more, however often it asks.
    if (balance >= TOP_UP_BELOW) {
      return NextResponse.json({ funded: false, reason: "has-gas" });
    }

    const hash = await (queue = queue.then(
      () => paying.wallet.sendTransaction({ to: address, value: DRIP }),
      () => paying.wallet.sendTransaction({ to: address, value: DRIP })
    ) as Promise<`0x${string}`>);

    lastFunded.set(key, Date.now());
    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ funded: true, hash });
  } catch (cause) {
    // Never echo the cause: it carries the sponsor's address, its balance and
    // its nonce. The client only needs to know gas did not arrive.
    console.error("[fund] drip failed", cause);
    return NextResponse.json(
      { funded: false, reason: "failed" },
      { status: 502 }
    );
  }
}

/**
 * Telegram's own signature over the launch payload, per its Mini Apps spec:
 * the secret is the bot token keyed by "WebAppData", and the signed message is
 * every field but `hash`, sorted, joined by newlines.
 */
function fromTelegram(initData: string | undefined): boolean {
  if (!initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");

    // A signature stays valid forever unless it is aged out, and a leaked one
    // would otherwise be a permanent key to the sponsor's wallet.
    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > 86_400) return false;

    const check = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = createHmac("sha256", "WebAppData")
      .update(process.env.TELEGRAM_BOT_TOKEN as string)
      .digest();
    const expected = createHmac("sha256", secret).update(check).digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
