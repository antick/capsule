import type { ProviderId, UsageSnapshot } from "@capsule/config";

export interface UsageProviderContext {
  now: Date;
}

export interface UsageProvider {
  id: ProviderId;
  fetchSnapshot: (context: UsageProviderContext) => Promise<UsageSnapshot>;
}
