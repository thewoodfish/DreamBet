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
 * Somnia (Latin: "dreams") doesn't have a fixed brand mark to source here, so
 * this is a bespoke crescent-and-star glyph that ties the chain name back to
 * the DreamBet theme rather than reusing an unverified logo.
 */
function SomiMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="somiBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#somiBg)" />
      <path
        d="M19,8 a9,9 0 1 0 0,16 a7.2,7.2 0 1 1 0,-16 Z"
        fill="#fff"
        fillOpacity="0.95"
      />
      <circle cx="22.6" cy="10.2" r="1.6" fill="#fff" />
    </svg>
  );
}

const MARKS: Record<AssetSymbol, () => React.JSX.Element> = {
  BTC: BtcMark,
  ETH: EthMark,
  SOMI: SomiMark,
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
