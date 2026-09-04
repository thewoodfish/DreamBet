# Deploying DreamBet

Telegram hosts nothing. A Mini App is a URL in a webview: Telegram stores the
URL and no more than that — no bundle upload, no build step, no version, no
review. Everything here runs on your own hosting, and Telegram points at it.

That absence is the good news. There is no release to submit and no gate to
wait behind, so **auto-deploy is whatever your host already does on push**:
merge to `main`, the host builds, and the next person to open the Mini App has
the new version. Nobody updates anything.

---

## One-time setup

### 1. Host it

Any HTTPS host with a real certificate works; Telegram refuses self-signed and
refuses plain HTTP. Vercel is the least friction for Next.js — import the repo,
accept the defaults, deploy.

Worth knowing: the screens build as `○ (Static)`, but `/api/fund` builds as
`ƒ (Dynamic)` and needs a Node runtime — it holds the gas sponsor's key. A
static export would drop that route silently, and the first thing anyone would
notice is players unable to place their first bet.

These are public by design — they ship to the browser:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | From the Privy dashboard |
| `NEXT_PUBLIC_SOMNIA_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_TELEGRAM_BOT` | Bot username, no `@` — e.g. `dreambet_bot` |
| `NEXT_PUBLIC_TELEGRAM_APP` | Mini App short name from step 2 |

**These are inlined at build time, not read at runtime.** Next bakes every
`NEXT_PUBLIC_*` into the bundle, so changing one requires a rebuild — a restart
will not pick it up.

And these are server-only. The prefix is the whole difference: a
`NEXT_PUBLIC_` in front of the first one would publish the sponsor's key to
every player.

| Variable | Value |
| --- | --- |
| `GAS_SPONSOR_PRIVATE_KEY` | Key of the wallet paying everyone's gas. Fund the address with STT |
| `TELEGRAM_BOT_TOKEN` | From BotFather. Without it, `/api/fund` drips to any address that asks |
| `GAS_SPONSOR_TARGET_STT` | Optional. What a wallet is topped up to, default `0.15` |

`GET /api/fund` reports the sponsor's address, its balance and how many players
are left in it — the one number to check before a demo.

### 2. Register the Mini App with BotFather

```
/newbot          -> pick a name and username; keep the token
/newapp          -> choose the bot, give it a short name and your HTTPS URL
/setmenubutton   -> attach the app to the bot's menu button
```

The short name and the bot username are what `t.me/<bot>/<app>` resolves to,
and they are what `challengeUrl` in `lib/challenge.ts` builds share links from.

**There is a chicken-and-egg here.** You need the deployed URL before you can
register the app, and you need the app's short name before the app can build
real `t.me` links. So the order is: deploy → register → set
`NEXT_PUBLIC_TELEGRAM_BOT` and `NEXT_PUBLIC_TELEGRAM_APP` → **redeploy**. Until
that second deploy, challenge links fall back to the app's own origin. They
still carry the challenge and still work — they just open the site rather than
the Mini App.

### 3. Configure Privy

In the Privy dashboard:

- Allowlist the production domain, or logins fail on a domain check.
- Register the bot token under Telegram login, or `loginMethods: ["telegram"]`
  never completes.

Somnia is already pinned in `Providers.tsx` as both `defaultChain` and the sole
`supportedChains` entry, so there is nothing chain-side to configure — that is
deliberate, since a user signed in on another chain would have no event
contract to bet on.

---

## After that: pushing is deploying

Point the host at `main` and there is nothing else to operate. Telegram fetches
the URL fresh each time the Mini App opens, so a merged change is live to the
next person who opens it.

CI (`.github/workflows/ci.yml`) gates a merge on typecheck, lint, `npm run
verify` and a production build. It deliberately does **not** gate on the live
venue check — see below.

CI runs Node 24, and `engines` requires 22.18 or newer. That floor is real, not
a preference: the verifier runs `.mts` sources directly on Node's own type
stripping, and its resolve hook needs `module.registerHooks`. Neither exists on
Node 20, which fails before the first check runs.

---

## Testing inside Telegram before you ship

`localhost:3000` cannot be registered: Telegram requires HTTPS with a valid
certificate. Tunnel it:

```bash
npm run dev
cloudflared tunnel --url http://localhost:3000    # or: ngrok http 3000
```

Register that URL against a **separate dev bot**. Pointing your production bot
at a tunnel replaces the live URL, and the tunnel dies when you close your
laptop.

Outside Telegram the app degrades rather than breaking, so most of the work
does not need a tunnel at all:

- Haptics become no-ops.
- The native share falls back to the platform share sheet, then the clipboard.
- `?startapp=<param>` in the address bar stands in for a Telegram start
  parameter, so the whole challenge loop is exercisable in a browser.
- The leaderboard's "this group" tab is disabled, because outside a group there
  is no `chat_instance` to scope it by.

---

## Two things that will bite you

**Telegram's webview caches hard.** Next's hashed filenames cover JS and CSS,
but a stale HTML shell is the usual reason a Mini App "didn't update". Closing
and reopening the app is not always enough; Telegram's own cache clear
(Settings → Data and Storage) is. Suspect this before you suspect the deploy.

**The live venue check is not a test of this code.** `npm run verify:dreamdex`
asserts against Somnia's Shannon testnet, which times out, goes stale, and
stops rolling 15m windows on its own schedule. Those failures are real
information — they say the venue is degraded — but they are not regressions
here, which is why CI runs that job with `continue-on-error` and gates on
`npm run verify` instead.

```bash
npm run verify           # pure: economics, fills, challenge links. Offline, deterministic.
npm run verify:dreamdex  # the above plus the live Shannon deployment.
```
