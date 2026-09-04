import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram's own signature over the launch payload, per its Mini Apps spec:
 * the secret is the bot token keyed by "WebAppData", and the signed message is
 * every field but `hash`, sorted, joined by newlines.
 *
 * This is the only thing standing between these routes and anonymous internet
 * traffic — one spends gas, the other writes the leaderboard — so both check it
 * the same way rather than each growing its own version.
 *
 * Returns false when no bot token is configured, so callers decide explicitly
 * whether an unverified request is acceptable in that context.
 */
export function verifyTelegram(initData: string | undefined): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");

    // A signature stays valid forever unless it is aged out, and a leaked one
    // would otherwise be a permanent key to whatever it authorises.
    const authDate = Number(params.get("auth_date") ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > 86_400) return false;

    const check = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const expected = createHmac("sha256", secret).update(check).digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** True when signatures are being checked at all. */
export const telegramAuthConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
