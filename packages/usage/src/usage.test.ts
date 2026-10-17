import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { createPoller } from "./poller.ts";
import { createDemoProvider } from "./providers/demo.ts";

/**
 * Pure mapping lives in `providers/mapping.test.ts` and each provider's whole
 * read against a stub world in `reads-fixtures.test.ts`, both in the fixture
 * corpus. What is left here is the poller and the demo provider.
 */
describe("demo provider", () => {
  it("returns the reference Claude snapshot", async () => {
    const provider = createDemoProvider("claude");
    const snapshot = await provider.fetchSnapshot({
      now: new Date(),
      fetch: globalThis.fetch,
      readFile: async () => null,
      homeDir: "/tmp",
    });
    expect(snapshot.primaryPercent).toBe(73);
    expect(snapshot.buckets[0]?.percentUsed).toBe(73);
    expect(snapshot.buckets[1]?.percentUsed).toBe(7);
  });
});

describe("poller", () => {
  it("only fetches enabled providers", async () => {
    const fetched: string[] = [];
    const poller = createPoller({
      providers: [
        {
          id: "claude",
          fetchSnapshot: async () => {
            fetched.push("claude");
            const snapshot = DEMO_SNAPSHOTS.find(
              (item) => item.providerId === "claude",
            );
            if (!snapshot) {
              throw new Error("missing claude demo");
            }
            return snapshot;
          },
        },
        {
          id: "codex",
          fetchSnapshot: async () => {
            fetched.push("codex");
            const snapshot = DEMO_SNAPSHOTS.find(
              (item) => item.providerId === "codex",
            );
            if (!snapshot) {
              throw new Error("missing codex demo");
            }
            return snapshot;
          },
        },
      ],
      host: {
        now: () => new Date(),
        fetch: globalThis.fetch,
        readFile: async () => null,
        homeDir: () => "/tmp",
        interval: () => () => undefined,
        onResume: () => () => undefined,
        onOnline: () => () => undefined,
      },
      getSettings: () => ({
        ...defaultSettings(),
        enabledProviderIds: ["claude"],
        demoMode: true,
      }),
      onChange: () => undefined,
    });
    await poller.refresh();
    expect(fetched).toEqual(["claude"]);
  });
});
