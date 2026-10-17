import { defaultSettings, type UsageSnapshot } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { rememberedSnapshots } from "../poller.ts";
import type { UsageProviderContext } from "../types.ts";
import { createCopilotProvider } from "./copilot.ts";
import { createCursorProvider } from "./cursor.ts";

const now = new Date("2026-08-27T11:22:00.000Z");

function context(
  overrides: Partial<UsageProviderContext>,
): UsageProviderContext {
  return {
    now,
    fetch: () => Promise.reject(new Error("no network")),
    readFile: () => Promise.resolve(null),
    homeDir: "/home",
    ...overrides,
  };
}

/**
 * Cursor and Copilot payload mapping and token reading moved to the fixture
 * corpus; see `mapping.test.ts`. What is left needs a stubbed host.
 */
describe("cursor", () => {
  it("is not connected without a token, and sends the session as a cookie", async () => {
    const provider = createCursorProvider();
    const none = await provider.fetchSnapshot(context({}));
    expect(none.status).toBe("unauthenticated");

    let cookie = "";
    const token = `x.${Buffer.from(JSON.stringify({ sub: "user_42" })).toString("base64url")}.y`;
    await provider.fetchSnapshot(
      context({
        runCommand: () => Promise.resolve(Buffer.from(token).toString("hex")),
        fetch: async (_url, init) => {
          cookie = new Headers(init?.headers).get("Cookie") ?? "";
          return new Response(
            JSON.stringify({
              individualUsage: { plan: { totalPercentUsed: 42.4 } },
            }),
          );
        },
      }),
    );
    expect(cookie).toContain(token);
  });
});

describe("copilot", () => {
  it("prefers the gh CLI's token over Copilot's file, and treats 404 as not connected", async () => {
    const provider = createCopilotProvider();
    let auth = "";
    const ok = await provider.fetchSnapshot(
      context({
        runCommand: (file) =>
          Promise.resolve(file === "gh" ? "gho_cli\n" : null),
        readFile: () =>
          Promise.resolve(JSON.stringify({ a: { oauth_token: "gho_file" } })),
        fetch: async (_url, init) => {
          auth = new Headers(init?.headers).get("Authorization") ?? "";
          return new Response(
            JSON.stringify({
              quota_snapshots: {
                premium_interactions: { percent_remaining: 90 },
              },
            }),
          );
        },
      }),
    );
    expect(auth).toBe("token gho_cli");
    expect(ok.primaryPercent).toBe(10);

    const none = await provider.fetchSnapshot(
      context({
        readFile: () =>
          Promise.resolve(JSON.stringify({ a: { oauth_token: "gho_file" } })),
        fetch: async () => new Response("", { status: 404 }),
      }),
    );
    expect(none.status).toBe("unauthenticated");
  });
});

describe("rememberedSnapshots", () => {
  it("shows the last good numbers, dated and stale, and placeholders otherwise", () => {
    const good: UsageSnapshot = {
      providerId: "claude",
      displayName: "Claude",
      iconId: "claude",
      primaryPercent: 40,
      status: "ok",
      fetchedAt: "2026-08-27T10:00:00.000Z",
      buckets: [
        {
          id: "s",
          label: "Session",
          percentUsed: 40,
          resetsAt: now.toISOString(),
          resetStyle: "relative",
        },
      ],
    };
    const dead: UsageSnapshot = {
      ...good,
      providerId: "codex",
      iconId: "codex",
      status: "unauthenticated",
      buckets: [],
    };
    const shown = rememberedSnapshots(defaultSettings().enabledProviderIds, [
      good,
      dead,
    ]);
    expect(shown.map((s) => s.providerId)).toEqual(["claude", "codex", "grok"]);
    expect(shown[0]).toMatchObject({
      status: "stale",
      primaryPercent: 40,
      staleSince: "2026-08-27T10:00:00.000Z",
    });
    expect(shown[1]?.status).toBe("unauthenticated");
    expect(shown[2]?.buckets).toEqual([]);
  });
});
