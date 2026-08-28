import type { ProviderId, UsageSnapshot } from "@capsule/config";

const NAMES: Record<ProviderId, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  spark: "Spark",
};

export function unauthenticatedSnapshot(
  providerId: ProviderId,
  fetchedAt: Date,
): UsageSnapshot {
  return {
    providerId,
    displayName: NAMES[providerId],
    iconId: providerId,
    primaryPercent: null,
    buckets: [],
    status: "unauthenticated",
    fetchedAt: fetchedAt.toISOString(),
  };
}
