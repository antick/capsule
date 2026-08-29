import {
  PROVIDER_LABELS,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";

export function unauthenticatedSnapshot(
  providerId: ProviderId,
  fetchedAt: Date,
): UsageSnapshot {
  return {
    providerId,
    displayName: PROVIDER_LABELS[providerId],
    iconId: providerId,
    primaryPercent: null,
    buckets: [],
    status: "unauthenticated",
    fetchedAt: fetchedAt.toISOString(),
  };
}
