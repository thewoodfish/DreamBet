/** Price with the asset's own precision and thousands separators. */
export function formatPrice(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Signed percentage, e.g. "+1.24%". */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Collateral amount, trimmed of trailing noise. */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 0x1234…cdef */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Wall-clock ms → "3:15 PM". Client-only: the server can't know the timezone. */
export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Seconds → "5:42" (or "1:05:42" once past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * A window length as a player would say it — "15 min", "1 hour".
 *
 * The app trades whichever cadence the venue has open, so this is never a
 * constant: the share card and the copy that leaves the app both have to name
 * the window the bet was actually placed in, or the bet is misdescribed to
 * everyone who reads it.
 */
export function windowLabel(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const minutes = Math.max(Math.round(seconds / 60), 1);
  return `${minutes} min`;
}

/** Tick lengths a countdown bar will divide a window into, coarsest first. */
const TICK_SECONDS = [300, 60, 30, 15, 5] as const;

/**
 * How many ticks to cut a window into on the countdown's fuse.
 *
 * One tick per minute was right while the app only ever traded 15-minute
 * windows. It stopped being right once the app started trading whichever
 * cadence is open: an hourly window becomes sixty hairlines, and a one-minute
 * window becomes a single bar with nothing to count. So the fuse takes the
 * coarsest tick that still leaves a countable number of them — roughly a dozen
 * at every cadence — and the exact time remaining stays where it always was,
 * in the digits above it.
 */
export function countdownTicks(windowSeconds: number, fallback = 15): number {
  for (const tick of TICK_SECONDS) {
    const count = Math.round(windowSeconds / tick);
    if (count >= 8 && count <= 24) return count;
  }
  return fallback;
}
