"use client";

import { useId, useMemo } from "react";

const VIEW_W = 300;
const VIEW_H = 100;
const PAD_Y = 8;

interface SparklineProps {
  points: number[];
  positive: boolean;
  /**
   * The window's shared strike, drawn as a reference line across the chart.
   * Present before the user bets — the line is the thing being bet on, so it
   * has to be visible while deciding, not only afterwards.
   */
  strikePrice?: number;
}

/**
 * Minimalist trend line for the last hour. Drawn in a fixed viewBox and
 * stretched with preserveAspectRatio="none"; `vector-effect` keeps the stroke
 * an even weight despite the non-uniform scale.
 */
export function Sparkline({ points, positive, strikePrice }: SparklineProps) {
  const gradientId = useId();
  const stroke = positive ? "#22c55e" : "#f43f5e";

  const { line, area, lastX, lastY, strikeY } = useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;

    const coords = points.map((value, i) => {
      const x = (i / (points.length - 1)) * VIEW_W;
      const y =
        VIEW_H - PAD_Y - ((value - min) / span) * (VIEW_H - PAD_Y * 2);
      return [x, y] as const;
    });

    const d = coords
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");

    const [fx, fy] = coords[coords.length - 1];

    // Clamp the strike line into view so it stays visible even after a big move.
    const toY = (value: number) =>
      VIEW_H - PAD_Y - ((value - min) / span) * (VIEW_H - PAD_Y * 2);
    const strike =
      strikePrice === undefined
        ? null
        : Math.min(Math.max(toY(strikePrice), PAD_Y), VIEW_H - PAD_Y);

    return {
      line: d,
      area: `${d} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`,
      lastX: fx,
      lastY: fy,
      strikeY: strike,
    };
  }, [points, strikePrice]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />

      {/* The strike: above it UP wins, below it DOWN wins. */}
      {strikeY !== null && (
        <line
          x1={0}
          y1={strikeY}
          x2={VIEW_W}
          y2={strikeY}
          stroke="#a1a1aa"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill={stroke}
        className="animate-pulse-ring"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
