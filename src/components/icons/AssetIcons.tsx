"use client";

import { useId } from "react";
import type { AssetSymbol } from "@/lib/assets";

/** Bitcoin: official orange disc with the classic double-stemmed ₿ mark. */
function BtcMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <rect x="11.4" y="9" width="2.1" height="14" rx="0.5" fill="#fff" />
      <path d="M12.4,9 H18.5 A3.35,3.35 0 0 1 18.5,15.7 H12.4 Z" fill="#fff" />
      <path d="M12.4,15.7 H19.3 A3.65,3.65 0 0 1 19.3,23 H12.4 Z" fill="#fff" />
      <rect x="14.3" y="5.4" width="1.7" height="4" rx="0.6" fill="#fff" />
      <rect x="17.3" y="5.4" width="1.7" height="4" rx="0.6" fill="#fff" />
      <rect x="14.3" y="22.6" width="1.7" height="4" rx="0.6" fill="#fff" />
      <rect x="17.3" y="22.6" width="1.7" height="4" rx="0.6" fill="#fff" />
    </svg>
  );
}

/** Ethereum: the canonical four-facet diamond. */
function EthMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0F0B24" />
      <polygon points="16,4 7,16.3 16,21" fill="#B9A6F2" />
      <polygon points="16,4 16,21 25,16.3" fill="#8C7CDB" />
      <polygon points="7,17.6 16,22.6 16,29" fill="#8C7CDB" />
      <polygon points="16,22.6 25,17.6 16,29" fill="#6653C4" />
    </svg>
  );
}

/**
 * Solana: the three slanted bars, each carrying the teal-to-purple sweep.
 *
 * The gradient needs an id to be referenced, and this mark can be on screen
 * more than once — the pill row and a history list both draw it — so the id is
 * per-instance rather than a module constant that would collide with itself.
 */
function SolMark() {
  // React's generated ids carry colons, which are legal in an id but awkward
  // everywhere they are later looked up. Stripping them keeps the reference
  // plain while staying unique per instance.
  const gradient = `sol-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#0B0B14" />
      {/* Each bar is a parallelogram sheared the way the mark leans; the outer
          two lean opposite the middle one. */}
      <path d="M9.6,10.4 H24 L22.4,12.9 H8 Z" fill={`url(#${gradient})`} />
      <path d="M8,17.2 H22.4 L24,19.7 H9.6 Z" fill={`url(#${gradient})`} />
      <path d="M9.6,21.6 H24 L22.4,24.1 H8 Z" fill={`url(#${gradient})`} />
    </svg>
  );
}

const MARKS: Record<AssetSymbol, () => React.JSX.Element> = {
  BTC: BtcMark,
  ETH: EthMark,
  SOL: SolMark,
};

interface AssetIconProps {
  symbol: AssetSymbol;
  className?: string;
}

export function AssetIcon({ symbol, className }: AssetIconProps) {
  const Mark = MARKS[symbol];
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className ?? ""}`}
    >
      <Mark />
    </span>
  );
}
