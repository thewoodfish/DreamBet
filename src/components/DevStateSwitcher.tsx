"use client";

import type { RoundState } from "@/lib/round";

const STATES: { value: RoundState; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "committed", label: "Committed" },
  { value: "settled", label: "Settled" },
];

interface DevStateSwitcherProps {
  value: RoundState;
  onChange: (state: RoundState) => void;
}

/**
 * Development-only. Lets us preview each round state on a real device while the
 * design is being settled, before any persistence or contract logic exists.
 * Rendered only in dev, so it never ships.
 */
export function DevStateSwitcher({ value, onChange }: DevStateSwitcherProps) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mx-5 flex items-center gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.04] p-1">
      <span className="px-1 text-[8px] font-bold uppercase tracking-widest text-amber-500/70">
        Dev
      </span>
      {STATES.map((state) => (
        <button
          key={state.value}
          type="button"
          onClick={() => onChange(state.value)}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
            value === state.value
              ? "bg-amber-500/20 text-amber-200"
              : "text-zinc-500 active:text-zinc-300"
          }`}
        >
          {state.label}
        </button>
      ))}
    </div>
  );
}
