# DreamBet

Telegram Mini App for [dreamDEX](https://dreamdex.xyz) Event Contracts on the Somnia Network.

Predict whether an asset closes UP or DOWN inside a 15-minute event window, in two taps, without leaving Telegram.

## Status

**All five steps complete.** The round, the odds, the money and the verdict are
real: windows and prices come off the live event contracts, a bet is a market
order against the resting book, settlement is the contract's own answer, and a
placed bet leaves as a challenge link that lands somebody on the other side of
it.

| Step | Scope | State |
| --- | --- | --- |
| 1 | Mobile-first UI shell | ✅ Done |
| 2 | Prediction / input bottom sheet | ✅ Done |
| 3 | Embedded wallet onboarding (Privy) | ✅ Done |
| 4 | dreamDEX contract read/write hooks | ✅ Done |
| 5 | Telegram haptics + viral share card | ✅ Done |

Still mocked, and deliberately so: the user's record, streak and leaderboard
(`MOCK_STATS` / `MOCK_HISTORY` in `lib/round.ts`, `MOCK_LEADERBOARD` in
`lib/leaderboard.ts`), which need settlement history the app does not yet keep.
The leaderboard's "this group" scope is already gated on a real `chat_instance`
— it is the standings behind it that are invented.

## Run it

```bash
npm install
cp .env.example .env.local   # add a Privy app id to enable signing
npm run dev
```

Open <http://localhost:3000>. The layout is locked to mobile dimensions and
renders inside a phone frame on wider screens. Without a Privy app id the app
still prices real markets — it just has nothing to sign with, and says so.

Testnet tUSDC and STT for gas come from the SomniaHacks faucet.

## Checks

```bash
npm run verify           # offline and deterministic — what CI gates on
npm run verify:dreamdex  # the above, plus the live Shannon deployment
```

`verify` covers the assumptions this app's own code makes: payout economics,
stake sizing over a book, fill accounting, settlement direction and the
challenge-link parser. No network, so a failure is always this repo's.

`verify:dreamdex` adds strike scaling, window shape, oracle prints and live
book depth read off Somnia's Shannon testnet. Those assertions are about a
third-party venue that times out, goes stale and stops rolling windows on its
own schedule — real information, but not a regression here, which is why CI
runs them without gating on them.

## Deploying

Telegram hosts nothing — a Mini App is a URL in a webview — so deployment is
your host's, and pushing to `main` is the whole release process. See
[DEPLOYING.md](DEPLOYING.md) for BotFather registration, the build-time env
vars, and how to test inside Telegram.

## Architecture

```
src/
  app/page.tsx           screen composition + round state machine
  components/            TopBar, AssetSelector, PriceWidget, Sparkline,
                         CountdownBar, MarketSentiment, PredictButtons,
                         TradeTicket, PositionCard, SettlementOverlay,
                         RecordSheet, LeaderboardList, StatsStrip
  hooks/useDreamdexWindow  the live window: market, boundary, odds
  hooks/useStakeQuote      what a stake buys, sized over the resting book
  hooks/usePriceFeed       oracle prints, read off the 1m market series
  hooks/useEventWindow     countdown driven by the market's own expiry
  hooks/useSettlement      waits for the contract's verdict
  hooks/useCollateralBalance  the wallet's tUSDC / USDso
  lib/dreamdex/config    network, collateral, cadences, tradable assets
  lib/dreamdex/client    read clients — public RPC + indexer
  lib/dreamdex/market    indexer rows normalised; odds from price
  lib/dreamdex/oracle    price history, read off the 1m series' strikes
  lib/dreamdex/book      stake -> shares, walked over the live book
  lib/dreamdex/trade     placing the order, and reading back its fills
  lib/account            who is playing, and what signs for them
  lib/telegram           launch context, haptics, native share
  lib/challenge          challenge links: build, parse, and the share copy
  lib/round              position shape and payout maths
```

### How a bet works

1. `useDreamdexWindow` picks the nearest 15m window that is genuinely open and
   reads the opening print it settles against.
2. Tapping a side opens `TradeTicket`, which sizes the typed stake against the
   pool's resting asks — so the multiplier shown is the one this order can get.
3. Confirm places a market IOC at the protective limit. UP buys YES, DOWN buys
   NO; outcome 0 is YES.
4. The position is recorded from the transaction's own fills, not from the
   quote.
5. `useSettlement` waits for the market to resolve and reads `winningOutcome`.
   A void returns the stake and is shown as a void, not a loss.

### How the challenge loop works

1. A bet is placed. The share card appears immediately, because that is the
   moment of most conviction — and again from the settlement screen, where "I
   won" travels further than "I bet".
2. `challengeUrl` encodes who, which asset and which side into a Telegram start
   parameter: `https://t.me/<bot>/<app>?startapp=<challenge>`.
3. `shareToChat` opens Telegram's native chat picker, so the link lands in the
   group the player came from. Outside Telegram it degrades to the platform
   share sheet and then the clipboard, so the loop is exercisable in a browser.
4. A recipient opens the link. `parseChallenge` reads it back, the app lands on
   the asset it names, and a banner names the side left over — theirs is taken,
   so the invitation is to oppose it.

Start parameters are attacker-supplied and forwarded links get mangled, so the
parser validates every field against what the app supports, caps the handle,
and tolerates lost base64 padding. Links are emitted unpadded, because Telegram
only accepts `[A-Za-z0-9_-]` in a start parameter.

### Running outside Telegram

Everything degrades rather than breaks. Haptics become no-ops, the native share
falls back to the clipboard, `?startapp=` in the address bar stands in for a
Telegram start parameter, and the "this group" leaderboard is disabled because
there is no `chat_instance` to scope it by.
