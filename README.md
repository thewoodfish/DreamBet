<p align="center">
  <img src="docs/logo.png" alt="DreamBet" width="440">
</p>

<p align="center">
  <b>Bet on where BTC, ETH or SOL closes in the next few minutes — from inside a Telegram group, in two taps, without ever meeting a wallet.</b>
</p>

<p align="center">
  A Telegram Mini App on <a href="https://dreamdex.xyz">dreamDEX</a> Event Contracts, running on the Somnia Network.
</p>

<p align="center">
  <b>Open it in Telegram: <a href="https://t.me/thedreambetbot/dreambet?startapp">t.me/thedreambetbot/dreambet?startapp</a></b>
</p>

---

## The argument happens in the group chat. The market doesn't.

Someone posts a chart. Someone says it's going down. Everyone has an opinion and nobody has a position, because taking one means leaving the conversation: install a wallet, write down a seed phrase, find some gas, bridge collateral, learn what a strike is, and come back twenty minutes later to a chat that has moved on.

That gap is why crypto prediction markets are a spectator sport for almost everyone. The people with the strongest opinions are the least likely to have the toolchain, and the moment worth betting on lasts about ninety seconds.

The on-chain venues have the mirror-image problem. dreamDEX runs real event contracts on Somnia with real order books — and reaches the small population already carrying a wallet and already looking at a DEX.

## Put the market where the argument already is

DreamBet is a Telegram Mini App, so it opens inside the conversation. No install, no download, no context switch.

<img src="docs/wallet.jpg" align="right" width="200" alt="The wallet">

**Your Telegram account is the login.** An embedded wallet is created behind it on first open. There is no seed phrase step, because there is no seed phrase to show — and a Telegram webview has no injected provider anyway, so an external wallet was never an option here.

**Gas is never the player's problem.** Every public STT faucet wants a browser wallet to connect and a Mini App has none, so the app sponsors it: one key underwrites every new player's first transactions, before their collateral claim and before their first bet. The word "gas" appears nowhere in the interface.

**Betting is two taps.** Pick a side, pick an amount. The odds come off the live order book, the window comes off the contract, and the result comes off the chain.

**And the bet leaves as an invitation.** A placed bet becomes a share card aimed back at the group it came from, naming the *opposite* side — because yours is taken. Everyone bets into the same public dreamDEX window, where the liquidity is; the private part is the scoreboard between you and the people in that chat.

<br clear="all">

---

## The product

*Every figure in these screens is real: live 15-minute windows, quotes walked off the resting book, and results the chain actually resolved.*

<table align="center">
<tr>
<td align="center" width="33%"><img src="docs/board.jpg" width="240" alt="The board"><br><sub><b>The board</b></sub></td>
<td align="center" width="33%"><img src="docs/ticket.jpg" width="240" alt="The ticket"><br><sub><b>The ticket</b></sub></td>
<td align="center" width="33%"><img src="docs/position.jpg" width="240" alt="The open bet"><br><sub><b>The open bet</b></sub></td>
</tr>
</table>

**The board.** Three assets as pills, each showing whether it has anything behind it right now — a dark one dims and refuses the tap rather than looking fine until you press it. A live price chart drawn from oracle prints, the line your bet settles against drawn across it, and a countdown that names the window it is counting: *15 min window*, *1 hour window*.

**The ticket.** Tap UP or DOWN and a sheet asks the only remaining question: how much. Quick-stake pills, and a payout quoted by walking the pool's actual resting asks — so the multiplier on screen is the one your order can get, slippage included, not the top-of-book number it would miss. Once it fills, the bet sits under the chart with its strike, the live price and what it pays, marked *winning* or *losing* as the price crosses the line.

<table align="center">
<tr>
<td align="center" width="33%"><img src="docs/pulse.jpg" width="240" alt="Market Pulse: too close"><br><sub><b>Market Pulse: too close</b></sub></td>
<td align="center" width="33%"><img src="docs/pulse-lead.jpg" width="240" alt="Market Pulse: clear lead"><br><sub><b>Market Pulse: clear lead</b></sub></td>
</tr>
</table>

**Market Pulse.** The read no exchange offers, because no exchange is betting on a fifteen-minute window: **how far the line is, measured in how far this asset actually travels in the time left.**

> *"BTC is 0.05% above the line, which is about 2 minutes of movement — UP is ahead, but the line is still in reach."*

0.05% means nothing alone. It means a great deal once you know BTC covers it in a typical minute and there are four minutes to run. A track draws the same comparison in space — the shaded band is everything reachable before expiry, and the dot drifts outward on its own as the clock runs down. Underneath: the median one-minute move from real prints, how the last six windows actually settled, resting book depth, and how many of your group are already in.

It describes and never advises. A test asserts the copy never reaches for *bet*, *should*, *likely*, *will* or *predict*.

<table align="center">
<tr>
<td align="center" width="33%"><img src="docs/result-win.jpg" width="240" alt="A win"><br><sub><b>A win</b></sub></td>
<td align="center" width="33%"><img src="docs/result-loss.jpg" width="240" alt="A miss"><br><sub><b>A miss</b></sub></td>
<td align="center" width="33%"><img src="docs/record.jpg" width="240" alt="Your record"><br><sub><b>Your record</b></sub></td>
</tr>
</table>

**The result.** A full-screen takeover the moment the window closes. A win overshoots — the bloom swells past its resting size, eighteen sparks burst from behind the number, a second haptic beat lands with it. A loss stays deliberately quiet, because a miss is not a failure, and an app that performs at somebody who has just lost money is one they close.

And it waits for you. The open bet is remembered across launches, so a window that closed while Telegram was shut shows its result the next time you open the app, marked *settled while you were away*. Every settled bet then lands in your record: streak, win rate, best run, and the bets behind them.

<table align="center">
<tr>
<td align="center" width="33%"><img src="docs/share.jpg" width="240" alt="The share card"><br><sub><b>The share card</b></sub></td>
<td align="center" width="33%"><img src="docs/challenge.jpg" width="240" alt="A challenge arriving"><br><sub><b>A challenge arriving</b></sub></td>
<td align="center" width="33%"><img src="docs/leaderboard.jpg" width="240" alt="The group"><br><sub><b>The group</b></sub></td>
</tr>
</table>

**The group.** It starts with the share card, sent back into the chat the bet came from. Whoever taps it lands on the same window with a banner naming the side still open — and the ticket stays shut until they choose to open it, because arriving from a chat to find a money dialog already up is a different product.

Then the standings, scoped to the chat you launched from, with a per-window tally of who is already in. Nothing on that table is taken on your word: a bet is written only once the chain confirms that exact transaction was sent by that exact address, and **the result is never stored at all** — outcomes are read back off the market when the table is built, so the one thing worth lying about cannot be sent.

---

## See it work

**[t.me/thedreambetbot/dreambet?startapp](https://t.me/thedreambetbot/dreambet?startapp)** — open it from a group chat and the standings scope to that group.

The trailing `?startapp` is what makes the link launch the Mini App rather than open a chat with the bot. Every challenge link the app generates carries it too, with the challenge encoded in it.

---

## Under the hood

### Run it and test it

```bash
npm install
cp .env.example .env.local   # add a Privy app id to enable signing
npm run dev
```

The layout is locked to mobile dimensions and renders in a phone frame on wider screens. Without a Privy app id it still prices real markets — it just has nothing to sign with, and says so. Test collateral is minted in-app: open the wallet sheet and tap **Get 10,000 tUSDC**, which calls `faucet()` on the TestUSDC contract itself.

The logic behind those screens is covered by two suites:

```bash
npm run verify           # offline and deterministic — what CI gates on
npm run verify:dreamdex  # the above, plus the live Shannon deployment
```

`verify` covers what this code assumes about itself: payout economics, stake sizing over a book, fill accounting, settlement direction, streak maths, the scoring rule, the challenge-link parser and the gas arithmetic below. No network, so a failure is always this repo's.

`verify:dreamdex` adds strike scaling, window shape, oracle prints, per-asset liveness and live book depth read off Shannon. That venue times out and goes stale on its own schedule, so CI runs these without gating on them.

Every check reads as a sentence, so a failure says what broke rather than which line did:

```
PASS  a fixed-strike window's line is its strike, with no opening print needed
PASS  there is no balance that is both funded and unable to transact
PASS  a void costs nothing, whichever side it was on
PASS  the copy never advises a side
```

### How a bet works

1. `useDreamdexWindow` queries every cadence dreamDEX trades (15-minute, 5-minute, hourly and 1-minute) at once, picks the nearest window genuinely open, and reads the line it settles against — the strike for a fixed market, the opening print for a reference one.
2. The ticket sizes the typed stake against the pool's resting asks, so the multiplier shown is the one this order can actually get.
3. Confirm places a market IOC at the protective limit. UP buys YES, DOWN buys NO; outcome 0 is YES. The approval and the order are two transactions, because ERC-20 requires the pool to be authorised and every window is a new pool.
4. The position is recorded from the transaction's own fills, never from the quote — the book can move between them, and only one of the two is a receipt.
5. `useSettlement` waits for the market to resolve and reads `winningOutcome` off the contract.

### Gas, measured rather than guessed

Somnia settles at a flat 6 gwei, but a wallet is checked against `gas × maxFeePerGas`, and the wallet builds every transaction at a **60 gwei** cap — ten times the price actually paid. With the SDK's default 10,000,000 gas ceiling, placing a bet demanded **0.6 STT on hand** to burn 0.0036. Nobody could bet.

So the ceiling is measured: a DreamBet order burns **595,412 gas**, and the heaviest order any caller has sent to these pools burnt 3.65M. `WRITE_GAS` is 2,000,000, and every other number derives from it:

```
WRITE_RESERVE = WRITE_GAS × WRITE_MAX_FEE   →   0.12 STT
refill below  = RESERVE × 1.25              →   0.15 STT
refill to     = RESERVE × 2                 →   0.24 STT
```

They are one constant, not four, because when they were separate a player ended up **richer than the refill line and poorer than the reserve** — funded by the only measure the sponsor had, and refused by the chain. A rejected transaction burns nothing, so nothing moved them out of it. There is now a test that walks every balance from zero to target and asserts no such band exists.

### Event Contracts used as a price feed

The venue publishes no standalone price API, and it turns out not to need one. Every market on the 1-minute series is created with a **fixed** strike, and that strike is the oracle's spot at the block the market was created in. Reading a run of them back *is* the oracle's own minute-by-minute history — real prints, on exactly the scale the longer windows settle against, taken from the same contracts the bet resolves on rather than from some third-party ticker that could disagree with them.

The chart, the line drawn across it, and Market Pulse's typical-move figure all come out of that one observation. Reference-mode rows carry strike `0` as a sentinel, so they are dropped rather than plotted as a crash to zero.

### Honest about a venue that is not always there

There is no locally-invented round: windows, strikes, odds and verdicts all come off dreamDEX. Which means the app has to tell the truth when the venue is having a bad day.

- **Four cadences, in a preference order.** 15-minute windows first, falling back through 5-minute, hourly and 1-minute — all four queried at once and ranked afterwards, so the *empty* case is one round trip rather than four. The window it found is named on the countdown, the ticket and the share card, because a bet that settles in an hour must not be described as five minutes to the group receiving it.
- **Liveness is per asset.** BTC and ETH move together only because the same creator rolls them; SOL's market has not gone live yet. Each pill reads its own.
- **Two resolution modes.** A reference market settles against its opening oracle print; a fixed-strike market carries the line in its own question and never posts one. Reading only the opening print made every fixed-strike window unbettable — half the board — with no error, just buttons that never came alive.
- **A void is never dressed as a loss.** The oracle declined to answer, the stake came back, and the record says `Void` rather than a red zero.

### Running outside Telegram

Everything degrades rather than breaks. Haptics become no-ops, native share falls back to the clipboard, `?startapp=` in the address bar stands in for a Telegram start parameter, and the "this group" leaderboard is disabled because there is no `chat_instance` to scope it by.

### Architecture

```
src/
  app/page.tsx              screen composition + round state machine
  app/api/fund              gas sponsorship (holds the signing key)
  app/api/board             standings, verified against chain receipts
  app/api/board/window      who from your group is in this window
  app/api/board/history     your own settled bets
  components/               TopBar, AssetSelector, PriceWidget, Sparkline,
                            CountdownBar, MarketSentiment, PredictButtons,
                            TradeTicket, PositionCard, SettlementOverlay,
                            PulseSheet, RecordSheet, LeaderboardList
  hooks/useDreamdexWindow   the live window: market, boundary, odds
  hooks/useAssetLiveness    which pills have anything behind them
  hooks/useMarketPulse      past verdicts, book depth, the group's bets
  hooks/useStakeQuote       what a stake buys, sized over the resting book
  hooks/usePriceFeed        oracle prints, read off the 1m market series
  hooks/useEventWindow      countdown driven by the market's own expiry
  hooks/useSettlement       waits for the contract's verdict
  hooks/usePlayerRecord     streak, win rate, rounds — from settled bets
  hooks/usePlayerHistory    the receipts behind those figures
  lib/dreamdex/config       network, collateral, cadences, gas arithmetic
  lib/dreamdex/market       indexer rows normalised; odds from price
  lib/dreamdex/oracle       price history, read off the 1m series' strikes
  lib/dreamdex/book         stake -> shares, walked over the live book
  lib/dreamdex/trade        placing the order, and reading back its fills
  lib/pulse                 the market read, and the words for it
  lib/position-store        the open bet, remembered across launches
  lib/challenge             challenge links: build, parse, share copy
```

**Stack:** Next.js 14 (App Router) · Tailwind · Framer Motion · `@telegram-apps/sdk-react` · Privy embedded wallets · viem · `@somnia-chain/markets-sdk` · Upstash Redis for standings.

---

## Why this grows the venue

**It reaches people who are not looking for a DEX.** A Mini App needs no install and no download — the distribution is a link in a chat somebody is already reading. The people this puts in front of Event Contracts are not traders shopping for a venue; they are the ones already arguing about the price.

**Every bet asks for a counterparty.** The share card names the *opposite* side of the *same* window, so the viral loop does not merely add users — it adds order flow to both sides of one book. Six people arguing about BTC in a group chat become six market orders inside the same fifteen minutes, against each other, on dreamDEX's own liquidity.

**It teaches Event Contracts without a tutorial.** Nobody is asked to learn what a strike, a binary outcome token or an IOC is. They see a line on a chart, two buttons and a payout, and the vocabulary arrives later if it arrives at all. Market Pulse does the same job for volatility: it says how far the line is in minutes of ordinary movement, which is a concept that needs no glossary.

**It is a template rather than a fork.** Any asset dreamDEX lists appears in the pill row with no code change, and the same shell works for any binary window the venue rolls.

**And it can pay for itself with the venue's own primitive.** The pools carry a builder fee: a trader opts a frontend in through `approveBuilder` up to a ceiling the venue froze, and each order then attributes `builderFeeBpsTimes1k` to it. A paid version of DreamBet needs no custom contracts and no rake invented on top — the mechanism is in the SDK, capped by the venue, and approved by the player rather than taken from them.

Nothing is charged today, and no rate is named here on purpose: `maxBuilderFeeBps` reads as null on every Shannon market, so the ceiling a frontend must sit under has not been published yet. What is already known is the other half of the ledger: onboarding costs 0.24 STT per player — paid once, not per bet — and a bet burns about 0.0065 STT, so one top-up carries a player roughly 35 to 40 bets. That is the whole unit economic: a fixed cost per person, a per-bet fee against it, and a retention number that decides whether they meet.

---

## Where it goes

DreamBet runs on Somnia's Shannon testnet today: the venue is live, the contracts are real, and nothing on screen is simulated — only the collateral is free.

**Mainnet** is one env var for the chain, collateral and decimals, plus three things real money makes worth building:

- **Withdrawals.** An amount-and-recipient screen doing an ERC-20 transfer through the existing signer, with Privy's key export beside it — so the embedded wallet is genuinely the player's, and reaching their own funds never depends on this app being up.
- **A sponsor that is watched, and capped.** The key paying for onboarding has two guards it does not have yet: an alert before it empties, because the failure mode is that onboarding stops silently at exactly the moment the app is working, and a per-address cap, because today nothing stops fifty accounts draining it 0.24 at a time.
- **More assets, as the venue lists them.** SOL is already in the pill row and reads as paused because the SOL market on dreamDEX has not gone live yet. The moment it does, the pill lights up with no code change.

**Beyond that, the group is the thing to build on.** The standings already know which Telegram chat every bet came from, which is the hard part. Seasons that reset, a group's leaderboard pinned in the chat, head-to-head records between two people who keep taking opposite sides — none of that needs new on-chain machinery, only more done with the identity the app already has.

The bet is that prediction markets do not grow by finding more traders. They grow by reaching the people already arguing about the price, in the place they are already arguing.
