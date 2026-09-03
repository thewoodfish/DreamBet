"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AssetSelector } from "@/components/AssetSelector";
import { CountdownBar } from "@/components/CountdownBar";
import { DevStateSwitcher } from "@/components/DevStateSwitcher";
import { RecordSheet, type RecordTab } from "@/components/RecordSheet";
import { MarketSentiment } from "@/components/MarketSentiment";
import { PositionCard } from "@/components/PositionCard";
import { PredictButtons } from "@/components/PredictButtons";
import { PriceWidget } from "@/components/PriceWidget";
import { SettlementOverlay } from "@/components/SettlementOverlay";
import { StatsStrip } from "@/components/StatsStrip";
import { TopBar } from "@/components/TopBar";
import { TradeTicket } from "@/components/TradeTicket";
import { useCollateralBalance } from "@/hooks/useCollateralBalance";
import { useDreamdexWindow } from "@/hooks/useDreamdexWindow";
import { useEventWindow } from "@/hooks/useEventWindow";
import { usePriceFeed } from "@/hooks/usePriceFeed";
import { useSettlement } from "@/hooks/useSettlement";
import { useDreamAccount } from "@/lib/account";
import type { BetFill } from "@/lib/dreamdex/trade";
import { DEFAULT_ASSET, getAsset, type AssetSymbol } from "@/lib/assets";
import type { LeaderboardScope } from "@/lib/leaderboard";
import {
  MOCK_HISTORY,
  MOCK_STAKE,
  MOCK_STATS,
  isAhead,
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
  // Step 5 reads Telegram's initData: chat_instance only exists when the Mini
  // App is launched from a group, so group scope must degrade to global.
  const [scope, setScope] = useState<LeaderboardScope>("group");

  const asset = useMemo(() => getAsset(symbol), [symbol]);
  const feed = usePriceFeed(asset);

  // The contract's own window: which market, what it settles against, and what
  // the book is paying. Everything about the round is read from here.
  const { market, boundary, quote, loading: marketLoading } =
    useDreamdexWindow(symbol);
  const eventWindow = useEventWindow(market);

  const account = useDreamAccount();
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
  }

  function resetRound() {
    setPosition(null);
    setTicket(null);
    setRound("open");
  }

  function handleSelectAsset(next: AssetSymbol) {
    setSymbol(next);
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

  // A ticket is written against one window. When that window locks or rolls,
  // the bet it describes no longer exists, so it closes rather than sitting
  // there ready to submit an order the market would reject.
  useEffect(() => {
    if (ticket && !bettable) setTicket(null);
  }, [ticket, bettable]);

  // The contract has spoken. Nothing is decided locally — this only moves the
  // UI to the result once the window it was watching has actually resolved.
  useEffect(() => {
    if (round === "committed" && settlement !== null) setRound("settled");
  }, [round, settlement]);

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
              onShare={() => undefined}
              onNextRound={resetRound}
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
              onClose={() => setSheetOpen(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
