import type { ProviderId } from "./constants.ts";

export type UsageStatus = "ok" | "unauthenticated" | "error" | "stale";

export interface UsageBucket {
  id: string;
  label: string;
  percentUsed: number;
  resetsAt: string;
  resetStyle: "relative" | "absolute";
}

export interface UsageSnapshot {
  providerId: ProviderId;
  displayName: string;
  iconId: ProviderId;
  primaryPercent: number | null;
  buckets: UsageBucket[];
  status: UsageStatus;
  fetchedAt: string;
  /**
   * A fetch for this provider is in the air. The last good numbers stay on
   * screen while it runs; the meter just says so with a sweep round its ring.
   */
  refreshing?: boolean;
  /**
   * When the numbers on screen were last actually read, once they have gone
   * stale. A remembered reading has to be dated, or it quietly passes itself
   * off as live.
   */
  staleSince?: string;
}
