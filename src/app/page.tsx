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
import { useEventWindow } from "@/hooks/useEventWindow";
import { usePriceFeed } from "@/hooks/usePriceFeed";
import {
  DEFAULT_ASSET,
  getAsset,
  poolSnapshot,
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
  const [committedWindow, setCommittedWindow] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<RecordTab>("record");
  // Step 5 reads Telegram's initData: chat_instance only exists when the Mini
  // App is launched from a group, so group scope must degrade to global.
  const [scope, setScope] = useState<LeaderboardScope>("group");

  const asset = useMemo(() => getAsset(symbol), [symbol]);
  const pool = useMemo(() => poolSnapshot(symbol), [symbol]);
  const feed = usePriceFeed(asset);
  const eventWindow = useEventWindow();

  // Streak only advances on a win, and resets to zero on a loss.
  const streak =
    position && settlePrice !== null && didWin(position, settlePrice)
      ? MOCK_STATS.streak + 1
      : 0;

  function openPosition(direction: Direction) {
    setPosition({
      direction,
      stake: MOCK_STAKE,
      entryPrice: feed.price,
      payoutMultiplier:
        direction === "up" ? pool.payoutUp : pool.payoutDown,
    });
    setCommittedWindow(eventWindow.windowIndex);
    setRound("committed");
  }

  function resetRound() {
    setPosition(null);
    setSettlePrice(null);
    setCommittedWindow(null);
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
      entryPrice: feed.price * 0.9985,
      payoutMultiplier: pool.payoutUp,
    };
    setPosition(staged);
    setSettlePrice(next === "settled" ? feed.price : null);
    setCommittedWindow(eventWindow.windowIndex);
    setRound(next);
  }

  // The window the position was opened in has rolled over: freeze the settle
  // price and show the result.
  useEffect(() => {
    if (
      round === "committed" &&
      committedWindow !== null &&
      eventWindow.ready &&
      eventWindow.windowIndex !== committedWindow
    ) {
      setSettlePrice(feed.price);
      setRound("settled");
    }
  }, [round, committedWindow, eventWindow.ready, eventWindow.windowIndex, feed.price]);

  return (
    <div className="flex min-h-dvh justify-center bg-black">
      <main className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-zinc-950 sm:my-6 sm:h-[860px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem] sm:border sm:border-zinc-800/80 sm:shadow-2xl sm:shadow-black">
        {/* Ambient glow. While a position is open this tracks whether you're
            *winning*, not which way you bet — a DOWN bet that's printing should
            feel green, not red. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
            round === "committed" && position
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
              entryPrice={position?.entryPrice}
            />
            <CountdownBar window={eventWindow} />
          </div>

          <div className="space-y-3 pt-1">
            {round === "committed" && position ? (
              <PositionCard
                asset={asset}
                position={position}
                currentPrice={feed.price}
              />
            ) : (
              <>
                <PoolSentiment pool={pool} />
                <PredictButtons
                  pool={pool}
                  disabled={eventWindow.locked}
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
