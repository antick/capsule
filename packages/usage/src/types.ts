import type { ProviderId, UsageSnapshot } from "@capsule/config";

export interface UsageProviderContext {
  now: Date;
  fetch: typeof fetch;
  readFile: (absolutePath: string) => Promise<string | null>;
  homeDir: string;
}

export interface UsageProvider {
  id: ProviderId;
  fetchSnapshot: (context: UsageProviderContext) => Promise<UsageSnapshot>;
}
