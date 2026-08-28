import type { UsageSnapshot } from "@capsule/config";

export function mergeSnapshot(
  previous: UsageSnapshot | undefined,
  next: UsageSnapshot,
): UsageSnapshot {
  if (next.status === "ok" || next.status === "unauthenticated") {
    return next;
  }
  if (!previous || previous.status === "unauthenticated") {
    return next;
  }
  return {
    ...previous,
    status: "stale",
    fetchedAt: next.fetchedAt,
  };
}
