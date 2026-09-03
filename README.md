# DreamBet

Telegram Mini App for [dreamDEX](https://dreamdex.xyz) Event Contracts on the Somnia Network.

Predict whether an asset closes UP or DOWN inside a 15-minute event window, in two taps, without leaving Telegram.

## Status

**Step 1 of 5 complete** — the mobile-first UI shell. Everything currently runs on
mock data; no wallet or chain calls yet.

| Step | Scope | State |
| --- | --- | --- |
| 1 | Mobile-first UI shell | ✅ Done |
| 2 | Prediction / input bottom sheet | Not started |
| 3 | Embedded wallet onboarding (Privy) | Not started |
| 4 | dreamDEX contract read/write hooks | Not started |
| 5 | Telegram haptics + viral share card | Not started |

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The layout is locked to mobile dimensions and
renders inside a phone frame on wider screens.

## Architecture

```
src/
  app/page.tsx           screen composition + mock wallet constants
  components/            TopBar, AssetSelector, PriceWidget, Sparkline,
                         CountdownBar, PoolSentiment, PredictButtons
  hooks/usePriceFeed     simulated price walk (seeded, SSR-safe)
  hooks/useEventWindow   wall-clock-aligned 15m window + settlement lock
  lib/assets.ts          asset table, mock pool/parimutuel odds
  lib/format.ts          price / percent / duration / address formatting
```

### Notes for the next steps

- **Mock seams.** `MOCK_WALLET` / `MOCK_BALANCE` in `app/page.tsx` are what Step 3
  replaces. `poolSnapshot()` in `lib/assets.ts` and `usePriceFeed` are what Step 4
  replaces with live contract and oracle reads.
- **`handlePredict` in `app/page.tsx`** currently just arms a side. Step 2 opens the
  trade ticket off that same state.
- **SSR safety.** The opening price history is generated from a seeded PRNG so the
  server and client agree on first paint, and the countdown renders a skeleton
  until the first client tick — the server never guesses "now".
