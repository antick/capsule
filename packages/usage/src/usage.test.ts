import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./merge.ts";
import { createPoller } from "./poller.ts";
import { mapClaudeUsage } from "./providers/claude.ts";
import { createDemoProvider } from "./providers/demo.ts";
import { unauthenticatedSnapshot } from "./unauthenticated.ts";

describe("mapClaudeUsage", () => {
  it("maps five_hour to Current session and seven_day to All models", async () => {
    const snapshot = mapClaudeUsage(
      {
        five_hour: {
          utilization: 73,
          resets_at: "2026-08-27T12:13:00.000Z",
        },
        seven_day: {
          utilization: 7,
          resets_at: "2026-09-03T00:00:00.000Z",
        },
      },
      new Date("2026-08-27T11:22:00.000Z"),
    );
    expect(snapshot.primaryPercent).toBe(73);
    expect(snapshot.buckets).toHaveLength(2);
    expect(snapshot.buckets[0]?.label).toBe("Current session");
    expect(snapshot.buckets[1]?.label).toBe("All models");
    expect(snapshot.buckets[1]?.percentUsed).toBe(7);
  });
});

describe("unauthenticatedSnapshot", () => {
  it("omits primary percent instead of reporting 0", () => {
    const snapshot = unauthenticatedSnapshot("claude", new Date());
    expect(snapshot.status).toBe("unauthenticated");
    expect(snapshot.primaryPercent).toBeNull();
    expect(snapshot.buckets).toEqual([]);
  });
});

describe("mergeSnapshot", () => {
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
          id: "chatgpt",
          fetchSnapshot: async () => {
            fetched.push("chatgpt");
            const snapshot = DEMO_SNAPSHOTS.find(
              (item) => item.providerId === "chatgpt",
            );
            if (!snapshot) {
              throw new Error("missing chatgpt demo");
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
