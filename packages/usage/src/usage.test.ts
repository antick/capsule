import { DEMO_SNAPSHOTS, defaultSettings } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { RateLimitedError } from "./backoff.ts";
import { createPoller } from "./poller.ts";
import { createClaudeProvider } from "./providers/claude.ts";
import { createDemoProvider } from "./providers/demo.ts";

/**
 * Pure mapping, token reading, merging, and unauthenticated snapshots moved to
 * the fixture corpus; see `providers/mapping.test.ts`. What is left here needs
 * an injected host — a stubbed `fetch`, `readFile`, `readSecret`, or clock —
 * so it is wiring rather than a value a Swift suite can compare against.
 */
describe("claude provider reads", () => {
  it("reports a rate limit and carries the local cache along as the fallback", async () => {
    const provider = createClaudeProvider();
    const refusal = await provider
      .fetchSnapshot({
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
      })
      .then(() => null)
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(RateLimitedError);
    const snapshot = (refusal as RateLimitedError).fallback;
    expect(snapshot?.status).toBe("stale");
    expect(snapshot?.primaryPercent).toBe(73);
    expect(snapshot?.buckets[1]?.percentUsed).toBe(7);
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
    ).rejects.toMatchObject({ name: "RateLimitedError", fallback: null });
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
