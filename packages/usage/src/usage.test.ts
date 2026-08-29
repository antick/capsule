import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { mergeSnapshot } from "./merge.ts";
import { createPoller } from "./poller.ts";
import {
  claudeUsageFromCache,
  createClaudeProvider,
  mapClaudeUsage,
} from "./providers/claude.ts";
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

  it("drops a product row that just echoes the headline percent", () => {
    const snapshot = mapGrokCredits(
      {
        config: {
          creditUsagePercent: 41,
          currentPeriod: { end: "2026-08-30T08:15:36Z" },
          onDemandCap: { val: 0 },
          onDemandUsed: { val: 0 },
          productUsage: [
            { product: "GrokBuild", usagePercent: 41 },
            { product: "GrokChat" },
          ],
        },
      },
      new Date("2026-08-29T05:30:00.000Z"),
    );
    expect(snapshot.primaryPercent).toBe(41);
    expect(snapshot.buckets).toHaveLength(1);
    expect(snapshot.buckets[0]?.label).toBe("Weekly credits");
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

  it("still reads a JWT when expires_at is in the past", () => {
    const token = grokTokenFromFile(
      JSON.stringify({
        "https://accounts.x.ai/sign-in": {
          key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig",
          expires_at: "2020-01-01T00:00:00Z",
          user_id: "user-1",
        },
      }),
    );
    expect(token?.startsWith("eyJ")).toBe(true);
  });
});

describe("claude cache", () => {
  it("reads nested cachedUsageUtilization.utilization", () => {
    const payload = claudeUsageFromCache(
      JSON.stringify({
        cachedUsageUtilization: {
          utilization: {
            five_hour: { utilization: 73, resets_at: "2026-08-27T12:13:00Z" },
            seven_day: { utilization: 7, resets_at: "2026-09-03T00:00:00Z" },
          },
        },
      }),
    );
    expect(payload?.five_hour?.utilization).toBe(73);
    expect(payload?.seven_day?.utilization).toBe(7);
  });

  it("uses the local cache when oauth usage is rate limited", async () => {
    const provider = createClaudeProvider();
    const snapshot = await provider.fetchSnapshot({
      now: new Date("2026-08-27T11:22:00.000Z"),
      fetch: async () =>
        new Response(JSON.stringify({ error: "rate" }), { status: 429 }),
      readFile: async (path) => {
        if (path.endsWith(".credentials.json")) {
          return JSON.stringify({
            claudeAiOauth: { accessToken: "sk-ant-oat-test" },
          });
        }
        if (path.endsWith(".claude.json")) {
          return JSON.stringify({
            cachedUsageUtilization: {
              utilization: {
                five_hour: {
                  utilization: 73,
                  resets_at: "2026-08-27T12:13:00Z",
                },
                seven_day: {
                  utilization: 7,
                  resets_at: "2026-09-03T00:00:00Z",
                },
              },
            },
          });
        }
        return null;
      },
      homeDir: "/tmp",
    });
    expect(snapshot.status).toBe("stale");
    expect(snapshot.primaryPercent).toBe(73);
    expect(snapshot.buckets[1]?.percentUsed).toBe(7);
  });

  it("rejects a cache whose windows already rolled over", async () => {
    const provider = createClaudeProvider();
    await expect(
      provider.fetchSnapshot({
        now: new Date("2026-08-27T11:22:00.000Z"),
        fetch: async () =>
          new Response(JSON.stringify({ error: "rate" }), { status: 429 }),
        readFile: async (path) => {
          if (path.endsWith(".credentials.json")) {
            return JSON.stringify({
              claudeAiOauth: { accessToken: "sk-ant-oat-test" },
            });
          }
          if (path.endsWith(".claude.json")) {
            return JSON.stringify({
              cachedUsageUtilization: {
                utilization: {
                  five_hour: {
                    utilization: 73,
                    resets_at: "2026-08-20T12:13:00Z",
                  },
                  seven_day: {
                    utilization: 7,
                    resets_at: "2026-08-22T00:00:00Z",
                  },
                },
              },
            });
          }
          return null;
        },
        homeDir: "/tmp",
      }),
    ).rejects.toThrow("Claude usage HTTP 429");
  });

  it("falls back to the keychain when the file token is rejected", async () => {
    const provider = createClaudeProvider();
    const seen: string[] = [];
    const snapshot = await provider.fetchSnapshot({
      now: new Date("2026-08-27T11:22:00.000Z"),
      fetch: async (_input, init) => {
        const auth = new Headers(init?.headers).get("Authorization") ?? "";
        seen.push(auth);
        if (auth.endsWith("sk-ant-oat-keychain-000000000000")) {
          return new Response(
            JSON.stringify({
              five_hour: { utilization: 73, resets_at: "2026-08-27T12:13:00Z" },
              seven_day: { utilization: 7, resets_at: "2026-09-03T00:00:00Z" },
            }),
            { status: 200 },
          );
        }
        return new Response("nope", { status: 401 });
      },
      readFile: async (path) =>
        path.endsWith(".credentials.json")
          ? JSON.stringify({ claudeAiOauth: { accessToken: "stale-token" } })
          : null,
      readSecret: async () => "sk-ant-oat-keychain-000000000000",
      homeDir: "/tmp",
    });
    expect(seen[0]).toBe("Bearer sk-ant-oat-keychain-000000000000");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.primaryPercent).toBe(73);
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
