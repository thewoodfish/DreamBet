/**
 * The smallest possible key-value client for Upstash's REST API.
 *
 * Deliberately not a dependency. Upstash speaks plain HTTP with a bearer token,
 * this app needs six commands, and a Redis client inside a serverless function
 * is mostly connection machinery for connections that never get reused.
 *
 * Every function returns empty rather than throwing when the store is not
 * configured or a command fails. The leaderboard sits on top of the betting: it
 * must degrade to "no standings yet" and never take a screen down with it.
 */

const URL_ =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

/**
 * Whether anything can be stored at all. The KV_ names are what Vercel's
 * Upstash integration injects; the UPSTASH_ pair is what you get connecting
 * Upstash directly, and both are accepted so neither route surprises anyone.
 */
export const storeConfigured = Boolean(URL_ && TOKEN);

async function command<T>(args: (string | number)[]): Promise<T | null> {
  if (!storeConfigured) return null;

  try {
    const response = await fetch(URL_, {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const body = (await response.json()) as { result?: T };
    return body.result ?? null;
  } catch {
    return null;
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  return parse<T>(await command<string>(["GET", key]));
}

export async function readManyJson<T>(keys: string[]): Promise<T[]> {
  if (keys.length === 0) return [];
  const raw = await command<(string | null)[]>(["MGET", ...keys]);
  if (!raw) return [];
  return raw.map((r) => parse<T>(r)).filter((v): v is T => v !== null);
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await command(["SET", key, JSON.stringify(value)]);
}

/** Newest first, which is the order every read here wants. */
export async function pushFront(key: string, value: string): Promise<void> {
  await command(["LPUSH", key, value]);
}

export async function readFront(key: string, count: number): Promise<string[]> {
  return (await command<string[]>(["LRANGE", key, 0, count - 1])) ?? [];
}

/** Caps a list in place, so a busy group cannot grow without bound. */
export async function trim(key: string, count: number): Promise<void> {
  await command(["LTRIM", key, 0, count - 1]);
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
