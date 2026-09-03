"use client";

import { useCallback, useEffect, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { publicClient } from "@/lib/dreamdex/client";
import { NETWORK } from "@/lib/dreamdex/config";

/**
 * How often the balance is re-read. The number only moves when the user trades
 * or tops up, so this is a safety net rather than the primary path — a
 * confirmed trade calls `refresh` directly.
 */
const POLL_MS = 12_000;

export interface CollateralBalance {
  /** Collateral in whole units, or null while it has never been read. */
  value: number | null;
  /** Re-read now — call it after a trade settles rather than waiting a poll. */
  refresh: () => void;
}

/**
 * The connected wallet's balance of whatever the markets are denominated in
 * (tUSDC on testnet, USDso on mainnet — a 10^12 difference in scale, which is
 * why this descales by the network's own decimals rather than a constant).
 *
 * A failed read leaves the previous value standing instead of flashing a zero:
 * an RPC hiccup must never read as "your money is gone".
 */
export function useCollateralBalance(
  address: `0x${string}` | null
): CollateralBalance {
  const [value, setValue] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!address) {
      setValue(null);
      return;
    }

    // Guards against a slow read for the previous address landing after the
    // user has switched accounts, and against setting state post-unmount.
    let live = true;

    async function read() {
      try {
        const raw = await publicClient.readContract({
          address: NETWORK.collateral.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        if (live) setValue(Number(formatUnits(raw, NETWORK.collateral.decimals)));
      } catch {
        // Keep the last known figure; the next poll will correct it.
      }
    }

    read();
    const id = setInterval(read, POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [address, nonce]);

  return { value, refresh };
}
