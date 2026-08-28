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
}
