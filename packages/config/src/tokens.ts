import type { ProviderId } from "./constants.ts";

/**
 * Tokens a provider's agents have got through, counted from the session logs
 * they leave on this Mac. A different fact from the rate-limit percentage:
 * the limit says how close to the wall you are, this says how much road you
 * have covered.
 */
export interface TokenUsage {
  providerId: ProviderId;
  /** Since local midnight. */
  todayTokens: number;
  /** The last thirty days, today included. */
  monthTokens: number;
  scannedAt: string;
}

export type TokenUsageByProvider = Partial<Record<ProviderId, TokenUsage>>;

export const TOKENS = {
  /** How often the logs are re-read. Unchanged files cost a stat each. */
  scanIntervalMs: 60_000,
  /** Days in the longer window, today included. */
  historyDays: 30,
  /** Claude Code's transcripts, one folder per project. */
  claudeProjectsDirSegments: [".claude", "projects"] as const,
  /** Rollout files under Codex's date-sorted sessions tree. */
  codexSessionsDirSegments: [".codex", "sessions"] as const,
  /** Remembered per-file totals, so a fresh launch skips unchanged history. */
  maxCacheEntries: 4096,
  /** Longest line worth parsing; anything bigger is a blob, not a row. */
  maxLineBytes: 1_048_576,
} as const;

/** A day key for a daily histogram, in local time. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight `daysAgo` days before `now`. */
export function startOfDay(now: Date, daysAgo = 0): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  day.setDate(day.getDate() - daysAgo);
  return day;
}

/**
 * "1.2m", "840k", "12": compact, and rounded so the card's column never
 * jumps width as the number climbs.
 */
export function formatCompactCount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const scaled = (n: number, suffix: string) => {
    const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
    const text = n
      .toFixed(digits)
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
    return `${sign}${text}${suffix}`;
  };
  if (abs >= 1e9) {
    return scaled(abs / 1e9, "b");
  }
  if (abs >= 1e6) {
    return scaled(abs / 1e6, "m");
  }
  if (abs >= 1e3) {
    return scaled(abs / 1e3, "k");
  }
  return `${sign}${Math.round(abs)}`;
}
