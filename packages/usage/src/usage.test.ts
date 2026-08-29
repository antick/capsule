import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./merge.ts";
import { createPoller } from "./poller.ts";
import { mapClaudeUsage } from "./providers/claude.ts";
import { mapCodexUsage } from "./providers/codex.ts";
import { createDemoProvider } from "./providers/demo.ts";
import { grokTokenFromFile, mapGrokCredits } from "./providers/grok.ts";
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

  it("treats fractional utilization as a percent", () => {
    const snapshot = mapClaudeUsage(
      { five_hour: { utilization: 0.73 } },
      new Date("2026-08-27T11:22:00.000Z"),
    );
    expect(snapshot.primaryPercent).toBe(73);
  });
});

describe("mapCodexUsage", () => {
  it("maps WHAM primary and secondary windows", () => {
    const snapshot = mapCodexUsage(
      {
        plan_type: "plus",
        rate_limit: {
          primary_window: {
            used_percent: 21,
            limit_window_seconds: 18000,
            reset_at: 1782770922,
          },
          secondary_window: {
            used_percent: 8,
            limit_window_seconds: 604800,
            reset_at: 1783357722,
          },
        },
      },
      new Date("2026-08-27T11:22:00.000Z"),
    );
    expect(snapshot.providerId).toBe("codex");
    expect(snapshot.primaryPercent).toBe(21);
    expect(snapshot.buckets[0]?.label).toBe("5-hour window");
    expect(snapshot.buckets[1]?.label).toBe("Weekly");
    expect(snapshot.buckets[1]?.percentUsed).toBe(8);
  });
});

describe("mapGrokCredits", () => {
  it("maps weekly credit percent and build product usage", () => {
    const snapshot = mapGrokCredits(
      {
        config: {
          creditUsagePercent: 52,
          currentPeriod: {
            type: "USAGE_PERIOD_TYPE_WEEKLY",
            end: "2026-09-03T00:00:00Z",
          },
          productUsage: [{ product: "PRODUCT_GROK_BUILD", usagePercent: 18 }],
        },
      },
      new Date("2026-08-27T11:22:00.000Z"),
    );
    expect(snapshot.providerId).toBe("grok");
    expect(snapshot.primaryPercent).toBe(52);
    expect(snapshot.buckets[0]?.label).toBe("Weekly credits");
    expect(snapshot.buckets[1]?.label).toBe("Grok Build");
    expect(snapshot.buckets[1]?.percentUsed).toBe(18);
  });

  it("reads a JWT from nested Grok CLI auth.json", () => {
    const token = grokTokenFromFile(
      JSON.stringify({
        "https://accounts.x.ai/sign-in": {
          key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig",
        },
      }),
    );
    expect(token?.startsWith("eyJ")).toBe(true);
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
