"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AssetSelector } from "@/components/AssetSelector";
import { CountdownBar } from "@/components/CountdownBar";
import { DevStateSwitcher } from "@/components/DevStateSwitcher";
import { RecordSheet, type RecordTab } from "@/components/RecordSheet";
import { PoolSentiment } from "@/components/PoolSentiment";
import { PositionCard } from "@/components/PositionCard";
import { PredictButtons } from "@/components/PredictButtons";
import { PriceWidget } from "@/components/PriceWidget";
import { SettlementOverlay } from "@/components/SettlementOverlay";
import { StatsStrip } from "@/components/StatsStrip";
import { TopBar } from "@/components/TopBar";
import { useEventWindow, windowSettleAt } from "@/hooks/useEventWindow";
import { usePriceFeed } from "@/hooks/usePriceFeed";
import {
  DEFAULT_ASSET,
  getAsset,
  poolSnapshot,
  strikeFor,
  type AssetSymbol,
} from "@/lib/assets";
import type { LeaderboardScope } from "@/lib/leaderboard";
import {
  MOCK_HISTORY,
  MOCK_STAKE,
  MOCK_STATS,
  didWin,
  type Direction,
  type Position,
  type RoundState,
} from "@/lib/round";

/** Mock account — swapped for the Privy embedded wallet in Step 3. */
const MOCK_WALLET = "0x7A3f9C21b6E8d0F45aA1c7Bd93E2f80C1D4b6a5E";
const MOCK_BALANCE = 1_248.55;

export default function Home() {
  const [symbol, setSymbol] = useState<AssetSymbol>(DEFAULT_ASSET);
  const [round, setRound] = useState<RoundState>("open");
  const [position, setPosition] = useState<Position | null>(null);
  const [settlePrice, setSettlePrice] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<RecordTab>("record");
  // Step 5 reads Telegram's initData: chat_instance only exists when the Mini
  // App is launched from a group, so group scope must degrade to global.
  const [scope, setScope] = useState<LeaderboardScope>("group");

  const asset = useMemo(() => getAsset(symbol), [symbol]);
  const pool = useMemo(() => poolSnapshot(symbol), [symbol]);
  const feed = usePriceFeed(asset);
  const eventWindow = useEventWindow();

  // The line a new bet would settle against — the next window's once the
  // current one locks. Shared by every player, so UP and DOWN are opposites.
  const bettableStrike = strikeFor(asset, eventWindow.bettableWindow);

  // A position queued for a window that hasn't opened yet: no verdict to show.
  const pending =
    position !== null &&
    eventWindow.ready &&
    position.targetWindow > eventWindow.windowIndex;

  // Once the user is in, the chart tracks *their* line rather than the one on
  // offer — the two differ only for a bet queued into the next window.
  const shownStrike = position ? position.strike : bettableStrike;
  const shownSettleAt = eventWindow.ready
    ? windowSettleAt(position ? position.targetWindow : eventWindow.bettableWindow)
    : null;

  // Streak only advances on a win, and resets to zero on a loss.
  const streak =
    position && settlePrice !== null && didWin(position, settlePrice)
      ? MOCK_STATS.streak + 1
      : 0;

  function openPosition(direction: Direction) {
    setPosition({
      direction,
      stake: MOCK_STAKE,
      strike: bettableStrike,
      entryPrice: feed.price,
      targetWindow: eventWindow.bettableWindow,
      payoutMultiplier:
        direction === "up" ? pool.payoutUp : pool.payoutDown,
    });
    setRound("committed");
  }

  function resetRound() {
    setPosition(null);
    setSettlePrice(null);
    setRound("open");
  }

  function handleSelectAsset(next: AssetSymbol) {
    setSymbol(next);
    resetRound();
  }

  // Step 2 replaces this with the bottom-sheet trade ticket; for now a tap
  // commits the mock stake directly so the committed state is reachable.
  function handlePredict(direction: Direction) {
    openPosition(direction);
  }

  /**
   * Dev-only state preview. Jumping straight to `committed` or `settled` has to
   * synthesise the position the user would otherwise have built by betting.
   */
  function handleDevState(next: RoundState) {
    if (next === "open") {
      resetRound();
      return;
    }

    const staged: Position = position ?? {
      direction: "up",
      stake: MOCK_STAKE,
      strike: strikeFor(asset, eventWindow.windowIndex),
      entryPrice: feed.price * 0.9985,
      targetWindow: eventWindow.windowIndex,
      payoutMultiplier: pool.payoutUp,
    };
    setPosition({ ...staged, targetWindow: eventWindow.windowIndex });
    setSettlePrice(next === "settled" ? feed.price : null);
    setRound(next);
  }

  // The position's window has closed: freeze the settle price and show the
  // result. `>` rather than `!==` so a bet queued into the next window survives
  // the rollover that *starts* it.
  useEffect(() => {
    if (
      round === "committed" &&
      position !== null &&
      eventWindow.ready &&
      eventWindow.windowIndex > position.targetWindow
    ) {
      setSettlePrice(feed.price);
      setRound("settled");
    }
  }, [round, position, eventWindow.ready, eventWindow.windowIndex, feed.price]);

  return (
    <div className="flex min-h-dvh justify-center bg-black">
      <main className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-zinc-950 sm:my-6 sm:h-[860px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem] sm:border sm:border-zinc-800/80 sm:shadow-2xl sm:shadow-black">
        {/* Ambient glow. While a position is live this tracks whether you're
            *winning*, not which way you bet — a DOWN bet that's printing should
            feel green, not red. Stays neutral while a bet is merely queued. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
            round === "committed" && position && !pending
              ? didWin(position, feed.price)
                ? "bg-up/10"
                : "bg-down/10"
              : "bg-violet-600/10"
          }`}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <TopBar address={MOCK_WALLET} balance={MOCK_BALANCE} />
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
          <AssetSelector selected={symbol} onSelect={handleSelectAsset} />

          {/* The price card flexes to absorb slack, so the layout stays tight
              from an iPhone SE up to a Pro Max without dead space. */}
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
            <PriceWidget
              asset={asset}
              feed={feed}
              strike={shownStrike}
              settleAt={shownSettleAt}
            />
            <CountdownBar window={eventWindow} />
          </div>

          <div className="space-y-3 pt-1">
            {round === "committed" && position ? (
              <PositionCard
                asset={asset}
                position={position}
                currentPrice={feed.price}
                pending={pending}
                secondsLeft={eventWindow.secondsLeft}
              />
            ) : (
              <>
                <PoolSentiment pool={pool} />
                <PredictButtons
                  pool={pool}
                  locked={eventWindow.locked}
                  ready={eventWindow.ready}
                  secondsLeft={eventWindow.secondsLeft}
                  onPredict={handlePredict}
                />
              </>
            )}
            <DevStateSwitcher value={round} onChange={handleDevState} />
          </div>
        </div>

        <AnimatePresence>
          {round === "settled" && position && settlePrice !== null && (
            <SettlementOverlay
              key="settlement"
              asset={asset}
              position={position}
              settlePrice={settlePrice}
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
