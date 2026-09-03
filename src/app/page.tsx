"use client";

import { useMemo, useState } from "react";
import { AssetSelector } from "@/components/AssetSelector";
import { CountdownBar } from "@/components/CountdownBar";
import { PoolSentiment } from "@/components/PoolSentiment";
import { PredictButtons, type Direction } from "@/components/PredictButtons";
import { PriceWidget } from "@/components/PriceWidget";
import { TopBar } from "@/components/TopBar";
import { useEventWindow } from "@/hooks/useEventWindow";
import { usePriceFeed } from "@/hooks/usePriceFeed";
import { DEFAULT_ASSET, getAsset, poolSnapshot, type AssetSymbol } from "@/lib/assets";

/** Mock account — swapped for the Privy embedded wallet in Step 3. */
const MOCK_WALLET = "0x7A3f9C21b6E8d0F45aA1c7Bd93E2f80C1D4b6a5E";
const MOCK_BALANCE = 1_248.55;

export default function Home() {
  const [symbol, setSymbol] = useState<AssetSymbol>(DEFAULT_ASSET);
  const [armed, setArmed] = useState<Direction | null>(null);

  const asset = useMemo(() => getAsset(symbol), [symbol]);
  const pool = useMemo(() => poolSnapshot(symbol), [symbol]);
  const feed = usePriceFeed(asset);
  const eventWindow = useEventWindow();

  function handleSelectAsset(next: AssetSymbol) {
    setSymbol(next);
    setArmed(null);
  }

  // Step 2 replaces this with the bottom-sheet trade ticket.
  function handlePredict(direction: Direction) {
    setArmed((current) => (current === direction ? null : direction));
  }

  return (
    <div className="flex min-h-dvh justify-center bg-black">
      <main className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-zinc-950 sm:my-6 sm:h-[860px] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem] sm:border sm:border-zinc-800/80 sm:shadow-2xl sm:shadow-black">
        {/* Ambient glow that picks up the armed side. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
            armed === "up"
              ? "bg-up/15"
              : armed === "down"
                ? "bg-down/15"
                : "bg-violet-600/10"
          }`}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <TopBar address={MOCK_WALLET} balance={MOCK_BALANCE} />
          <AssetSelector selected={symbol} onSelect={handleSelectAsset} />

          {/* The price card flexes to absorb slack, so the layout stays tight
              from an iPhone SE up to a Pro Max without dead space. */}
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
            <PriceWidget asset={asset} feed={feed} />
            <CountdownBar window={eventWindow} />
          </div>

          <div className="space-y-3 pt-1">
            <PoolSentiment pool={pool} />
            <PredictButtons
              pool={pool}
              disabled={eventWindow.locked}
              active={armed}
              onPredict={handlePredict}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
