import { DEMO_SNAPSHOTS, type ProviderId } from "@capsule/config";
import type { UsageProvider, UsageProviderContext } from "../types.ts";

export function createDemoProvider(id: ProviderId): UsageProvider {
  return {
    id,
    fetchSnapshot: async (_context: UsageProviderContext) => {
      const snapshot = DEMO_SNAPSHOTS.find((item) => item.providerId === id);
      if (!snapshot) {
        throw new Error(`No demo snapshot for ${id}`);
      }
      return snapshot;
    },
  };
}
