import { DEMO_SNAPSHOTS } from "@capsule/config";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

export function createSparkProvider(options: {
  demoBacked: boolean;
}): UsageProvider {
  return {
    id: "spark",
    fetchSnapshot: async (context: UsageProviderContext) => {
      if (!options.demoBacked) {
        return unauthenticatedSnapshot("spark", context.now);
      }
      const snapshot = DEMO_SNAPSHOTS.find(
        (item) => item.providerId === "spark",
      );
      if (!snapshot) {
        return unauthenticatedSnapshot("spark", context.now);
      }
      return snapshot;
    },
  };
}
