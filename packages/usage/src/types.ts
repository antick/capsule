import type { ProviderId, UsageSnapshot } from "@capsule/config";

export interface UsageProviderContext {
  now: Date;
  fetch: typeof fetch;
  readFile: (absolutePath: string) => Promise<string | null>;
  readSecret?: (service: string) => Promise<string | null>;
  /**
   * Runs a local command and returns what it printed, or null if it failed or
   * is not installed. How Cursor's state store and GitHub's CLI are asked.
   */
  runCommand?: (
    file: string,
    args: readonly string[],
  ) => Promise<string | null>;
  homeDir: string;
}

export interface UsageProvider {
  id: ProviderId;
  fetchSnapshot: (context: UsageProviderContext) => Promise<UsageSnapshot>;
}
