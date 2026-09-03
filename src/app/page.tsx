"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AssetSelector } from "@/components/AssetSelector";
import { ChallengeBanner } from "@/components/ChallengeBanner";
import { CountdownBar } from "@/components/CountdownBar";
import { DevStateSwitcher } from "@/components/DevStateSwitcher";
import { RecordSheet, type RecordTab } from "@/components/RecordSheet";
import { MarketSentiment } from "@/components/MarketSentiment";
import { PositionCard } from "@/components/PositionCard";
import { PredictButtons } from "@/components/PredictButtons";
import { PriceWidget } from "@/components/PriceWidget";
import { SettlementOverlay } from "@/components/SettlementOverlay";
import { ShareSheet, type ShareSubject } from "@/components/ShareSheet";
import { StatsStrip } from "@/components/StatsStrip";
import { TopBar } from "@/components/TopBar";
import { TradeTicket } from "@/components/TradeTicket";
import { useCollateralBalance } from "@/hooks/useCollateralBalance";
import { useDreamdexWindow } from "@/hooks/useDreamdexWindow";
import { useEventWindow } from "@/hooks/useEventWindow";
import { usePriceFeed } from "@/hooks/usePriceFeed";
import { useSettlement } from "@/hooks/useSettlement";
import { useDreamAccount } from "@/lib/account";
import type { Challenge } from "@/lib/challenge";
import { haptic, useTelegram } from "@/lib/telegram";
import type { BetFill } from "@/lib/dreamdex/trade";
import { DEFAULT_ASSET, getAsset, type AssetSymbol } from "@/lib/assets";
import type { LeaderboardScope } from "@/lib/leaderboard";
import {
  MOCK_HISTORY,
  MOCK_STAKE,
  MOCK_STATS,
  isAhead,
  netResult,
  type Direction,
  type Position,
  type RoundState,
} from "@/lib/round";

/** Stand-in identity for when no wallet layer is configured, so the shell stays
    previewable without a Privy app id. */
const MOCK_WALLET = "0x7A3f9C21b6E8d0F45aA1c7Bd93E2f80C1D4b6a5E";
const MOCK_BALANCE = 1_248.55;

export default function Home() {
  const [symbol, setSymbol] = useState<AssetSymbol>(DEFAULT_ASSET);
  const [round, setRound] = useState<RoundState>("open");
  const [position, setPosition] = useState<Position | null>(null);
  /** The side the user has armed, and so the ticket that is open. */
  const [ticket, setTicket] = useState<Direction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<RecordTab>("record");
  /** What the share card is currently showing, if it is open. */
  const [share, setShare] = useState<ShareSubject | null>(null);
  /** The challenge this session arrived on, until it is acted on or dismissed. */
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [scope, setScope] = useState<LeaderboardScope>("global");

  const asset = useMemo(() => getAsset(symbol), [symbol]);
  const feed = usePriceFeed(asset);

  // The contract's own window: which market, what it settles against, and what
  // the book is paying. Everything about the round is read from here.
  const { market, boundary, quote, loading: marketLoading } =
    useDreamdexWindow(symbol);
  const eventWindow = useEventWindow(market);

  const telegram = useTelegram();
  const account = useDreamAccount();
  // Telegram's own handle is the better one: it is there from the first frame,
  // before any wallet exists, and it is the name the group already knows.
  const username = telegram.username ?? account.username;
  // chat_instance only exists when the Mini App was opened from a group, so
  // without one there is no group whose standings could be shown.
  const groupAvailable = telegram.chatInstance !== null;
  const collateral = useCollateralBalance(account.address);
  // Real balance once there is a wallet to read; the mock figure otherwise.
  const balance = account.isMock ? MOCK_BALANCE : collateral.value;

  // Only watched once the user is actually in a window, so an idle screen is
  // not polling for a verdict nobody is waiting on.
  const settlement = useSettlement(
    round === "committed" && position ? position.marketId : null
  );

  // A window can only be bet into once its opening print exists — that print is
  // the line the bet settles against, and there is no position without one.
  const bettable = market !== null && boundary !== null && !eventWindow.locked;

  // The line on the chart: the user's own once they are in, otherwise whatever
  // the window on offer will settle against.
  const shownStrike = position ? position.strike : boundary;

  // Streak only advances on a win, and resets to zero on a loss.
  const streak =
    position && settlement?.winner === position.direction
      ? MOCK_STATS.streak + 1
      : 0;

  /**
   * A confirmed order becomes the position. Every number here is what the
   * transaction actually did — the shares it filled and the collateral it
   * really spent — rather than the quote that preceded it, because the book can
   * move between the two and only one of them is a receipt.
   */
  function handlePlaced(fill: BetFill) {
    if (!market || !ticket || boundary === null) return;

    setPosition({
      direction: ticket,
      stake: fill.cost,
      marketId: market.marketId,
      strike: boundary,
      entryPrice: feed.price ?? boundary,
      payoutMultiplier: fill.payoutMultiplier,
    });
    setTicket(null);
    setRound("committed");
    // The stake has left the wallet; show that without waiting for the poll.
    collateral.refresh();
    // A bet that stays on one phone is worth nothing to this product, so the
    // card is offered at the moment of most conviction rather than buried.
    setShare({
      kind: "bet",
      direction: ticket,
      stake: fill.cost,
      multiplier: fill.payoutMultiplier,
    });
    // Whatever brought them here has been answered.
    setChallenge(null);
  }

  function resetRound() {
    setPosition(null);
    setTicket(null);
    setShare(null);
    setRound("open");
  }

  function handleSelectAsset(next: AssetSymbol) {
    setSymbol(next);
    // A challenge names one asset. Once the user has navigated away from it,
    // the banner is describing a screen they are no longer looking at.
    setChallenge(null);
    resetRound();
  }

  // Tapping a side arms it and asks the only remaining question — how much.
  function handlePredict(direction: Direction) {
    setTicket(direction);
  }

  /**
   * Dev-only state preview. Jumping straight to `committed` has to synthesise
   * the position the user would otherwise have built by betting; `settled`
   * cannot be forced, because the verdict belongs to the contract — it arrives
   * when the watched window actually resolves.
   */
  function handleDevState(next: RoundState) {
    if (next === "open" || !market || boundary === null) {
      resetRound();
      return;
    }

    setTicket(null);
    setPosition(
      position ?? {
        direction: "up",
        stake: MOCK_STAKE,
        marketId: market.marketId,
        strike: boundary,
        entryPrice: feed.price ?? boundary,
        payoutMultiplier: quote.payoutUp,
      }
    );
    setRound("committed");
  }

  /**
   * A challenge link decides which asset this session opens on — arriving from
   * a chat about BTC and landing on ETH would lose the thread. The side is
   * deliberately not armed for them: the banner names it, and the tap stays
   * theirs.
   */
  useEffect(() => {
    if (!telegram.ready || !telegram.challenge) return;
    setSymbol(telegram.challenge.symbol);
    setChallenge(telegram.challenge);
  }, [telegram.ready, telegram.challenge]);

  // "This group" needs a group to have launched from. Anywhere else the tab is
  // disabled, and a scope left pointing at it would show standings for nobody.
  useEffect(() => {
    if (groupAvailable) setScope("group");
  }, [groupAvailable]);

  // A ticket is written against one window. When that window locks or rolls,
  // the bet it describes no longer exists, so it closes rather than sitting
  // there ready to submit an order the market would reject.
  useEffect(() => {
    if (ticket && !bettable) setTicket(null);
  }, [ticket, bettable]);

  // The contract has spoken. Nothing is decided locally — this only moves the
  // UI to the result once the window it was watching has actually resolved.
  useEffect(() => {
    if (round !== "committed" || settlement === null || !position) return;
    setRound("settled");
    // The verdict is the one moment the phone should speak for itself. A loss
    // is a warning, not an error: nothing went wrong, the call just missed.
    if (settlement.voided) haptic.tap();
    else if (settlement.winner === position.direction) haptic.success();
    else haptic.warning();
  }, [round, settlement, position]);

  const ahead =
    position && feed.price !== null ? isAhead(position, feed.price) : false;

  return (
    <div className="flex min-h-dvh justify-center bg-black">
      <main className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-zinc-950 sm:my-6 sm:h-[860px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem] sm:border sm:border-zinc-800/80 sm:shadow-2xl sm:shadow-black">
        {/* Ambient glow. While a position is live this tracks whether you're
            *winning*, not which way you bet — a DOWN bet that's printing should
            feel green, not red. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
            round === "committed" && position
              ? ahead
                ? "bg-up/10"
                : "bg-down/10"
              : "bg-violet-600/10"
          }`}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <TopBar balance={balance} fallbackAddress={MOCK_WALLET} />
          <StatsStrip
            stats={MOCK_STATS}
            onOpenRecord={() => {
              setSheetTab("record");
              setSheetOpen(true);
            }}
            onOpenLeaderboard={() => {
              setSheetTab("leaderboard");
              setSheetOpen(true);
            }}
          />
          {/* Sits between the identity block and the trading half, outside the
              scroll flow: urgency drives the tap, so the clock can never be
              what scrolls out of view. */}
          <CountdownBar window={eventWindow} />
          <AssetSelector selected={symbol} onSelect={handleSelectAsset} />

          {/* The price card flexes to absorb slack, so the layout stays tight
              from an iPhone SE up to a Pro Max without dead space. */}
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
            <PriceWidget
              asset={asset}
              feed={feed}
              strike={shownStrike}
              settleAt={eventWindow.expiresAt}
            />
          </div>

          <div className="space-y-3 pt-1">
            <AnimatePresence>
              {challenge && round === "open" && (
                <ChallengeBanner
                  key="challenge"
                  challenge={challenge}
                  onDismiss={() => setChallenge(null)}
                />
              )}
            </AnimatePresence>

            {round === "committed" && position ? (
              <PositionCard
                asset={asset}
                position={position}
                currentPrice={feed.price}
                secondsLeft={eventWindow.secondsLeft}
                settling={eventWindow.locked}
              />
            ) : (
              <>
                <MarketSentiment quote={quote} market={market} />
                <PredictButtons
                  quote={quote}
                  bettable={bettable}
                  loading={marketLoading}
                  awaitingStrike={market !== null && boundary === null}
                  onPredict={handlePredict}
                />
              </>
            )}
            <DevStateSwitcher value={round} onChange={handleDevState} />
          </div>
        </div>

        <AnimatePresence>
          {ticket && market && boundary !== null && (
            <TradeTicket
              key="trade-ticket"
              asset={asset}
              direction={ticket}
              market={market}
              balance={balance}
              secondsLeft={eventWindow.secondsLeft}
              onClose={() => setTicket(null)}
              onPlaced={handlePlaced}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {round === "settled" && position && settlement && (
            <SettlementOverlay
              key="settlement"
              asset={asset}
              position={position}
              settlement={settlement}
              streak={streak}
              onShare={() =>
                setShare({
                  kind: "result",
                  direction: position.direction,
                  net: netResult(position, settlement.winner),
                  won: settlement.winner === position.direction,
                  voided: settlement.voided,
                })
              }
              onNextRound={resetRound}
            />
          )}
        </AnimatePresence>

        {/* Above the settlement takeover, because it is offered from it. */}
        <AnimatePresence>
          {share && (
            <ShareSheet
              key="share"
              asset={asset}
              subject={share}
              username={username}
              onClose={() => setShare(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sheetOpen && (
            <RecordSheet
              key="record-sheet"
              stats={MOCK_STATS}
              history={MOCK_HISTORY}
              tab={sheetTab}
              onTabChange={setSheetTab}
              scope={scope}
              onScopeChange={setScope}
              groupAvailable={groupAvailable}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
