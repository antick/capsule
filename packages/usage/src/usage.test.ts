import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./merge.ts";
import { createPoller } from "./poller.ts";
import { createDemoProvider } from "./providers/demo.ts";
import { unauthenticatedSnapshot } from "./unauthenticated.ts";

describe("unauthenticatedSnapshot", () => {
  it("omits primary percent instead of reporting 0", () => {
    const snapshot = unauthenticatedSnapshot("claude", new Date());
    expect(snapshot.status).toBe("unauthenticated");
    expect(snapshot.primaryPercent).toBeNull();
    expect(snapshot.buckets).toEqual([]);
  });
});

describe("mergeSnapshot", () => {
  it("clears old account readings when usage is disabled", () => {
    const previous = DEMO_SNAPSHOTS[0];
    if (!previous) throw new Error("Missing demo snapshot");
    const next = {
      ...previous,
      status: "disabled" as const,
      primaryPercent: null,
      buckets: [],
    };
    expect(mergeSnapshot(previous, next)).toEqual(next);
  });

  it("keeps the last good snapshot on error", () => {
    const previous = DEMO_SNAPSHOTS[0];
    if (!previous) {
      throw new Error("missing demo snapshot");
    }
    const merged = mergeSnapshot(previous, {
      ...previous,
      status: "error",
      primaryPercent: null,
      buckets: [],
    });
    expect(merged.status).toBe("stale");
    expect(merged.primaryPercent).toBe(73);
  });
});

describe("demo provider", () => {
  it("returns the reference Claude snapshot", async () => {
    const provider = createDemoProvider("claude");
    const snapshot = await provider.fetchSnapshot({
      now: new Date(),
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
