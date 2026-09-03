# DreamBet

Telegram Mini App for [dreamDEX](https://dreamdex.xyz) Event Contracts on the Somnia Network.

Predict whether an asset closes UP or DOWN inside a 15-minute event window, in two taps, without leaving Telegram.

## Status

**Steps 1–4 complete.** The round, the odds, the money and the verdict are all
real: windows and prices come off the live event contracts, a bet is a market
order against the resting book, and settlement is the contract's own answer.
What is left is Telegram itself — haptics, identity and the share card.

| Step | Scope | State |
| --- | --- | --- |
| 1 | Mobile-first UI shell | ✅ Done |
| 2 | Prediction / input bottom sheet | ✅ Done |
| 3 | Embedded wallet onboarding (Privy) | ✅ Done |
| 4 | dreamDEX contract read/write hooks | ✅ Done |
| 5 | Telegram haptics + viral share card | Not started |

Still mocked, and deliberately so: the user's record, streak and leaderboard
(`MOCK_STATS` / `MOCK_HISTORY` in `lib/round.ts`), which need history the app
does not yet keep.

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

## Verify against the live venue

```bash
npm run verify:dreamdex
```

Checks the assumptions this app is built on — strike scaling, window shape,
payout economics, stake sizing, fill accounting and settlement direction —
against the live Shannon deployment. The pure economics run before the network
is touched, so they still report when the indexer is down.

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

### Notes for Step 5

- **Identity.** `lib/account.tsx` already publishes the Telegram handle Privy
  gives it — that is the name the share card needs.
- **Group scope.** The leaderboard's `group` scope needs `chat_instance` from
  Telegram's `initData`, which only exists when the Mini App is launched from a
  group; it has to degrade to global when it isn't.
- **The share moment.** `SettlementOverlay` already takes an `onShare`, and the
  result screen is deliberately where it is asked for — "I won" travels further
  than "I bet".
