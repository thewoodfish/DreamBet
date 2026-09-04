import { NextResponse } from "next/server";
import { createWalletClient, formatEther, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient } from "@/lib/dreamdex/client";
import { NETWORK, NETWORK_NAME } from "@/lib/dreamdex/config";
import { telegramAuthConfigured, verifyTelegram } from "@/lib/server/telegram";

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

/**
 * What a funded wallet is topped up to.
 *
 * Sized against a ceiling, not a cost. The markets SDK sends every write with a
 * 10,000,000 gas ceiling and Somnia charges a flat 6 gwei, so the chain demands
 * 0.06 STT be on hand before it will accept an order at all — however little
 * that order actually burns, which is nearer 0.018. A player therefore needs
 * several times the ceiling to place more than one bet, and a target at exactly
 * the ceiling is a wallet that is refused on its own first transaction.
 */
const TARGET = parseEther(process.env.GAS_SPONSOR_TARGET_STT ?? "0.15");

/**
 * Below this a wallet is topped up. It has to sit above the 0.06 the chain
 * reserves per order: a wallet held just under the old half-target would have
 * been called funded while being unable to send anything at all.
 */
const TOP_UP_BELOW = parseEther("0.08");

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
    target: formatEther(TARGET),
    /** Players still fundable from what is left, give or take. */
    remaining: balance === null ? null : Number(balance / TARGET),
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
  if (telegramAuthConfigured && !verifyTelegram(body.initData)) {
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

    // Topped up to the target rather than sent a fixed amount, so a wallet
    // with a little left costs the sponsor only the difference.
    const value = TARGET - balance;

    const hash = await (queue = queue.then(
      () => paying.wallet.sendTransaction({ to: address, value }),
      () => paying.wallet.sendTransaction({ to: address, value })
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
