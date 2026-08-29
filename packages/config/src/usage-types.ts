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
}
