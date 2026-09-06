import { defaultSettings, type UsageSnapshot } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { rememberedSnapshots } from "../poller.ts";
import type { UsageProviderContext } from "../types.ts";
import {
  copilotTokenFromApps,
  createCopilotProvider,
  mapCopilotUsage,
} from "./copilot.ts";
import {
  createCursorProvider,
  cursorTokenFromHex,
  jwtSubject,
  mapCursorUsage,
} from "./cursor.ts";

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

/** A JWT whose payload says who it belongs to; the signature is irrelevant. */
const token = `x.${Buffer.from(JSON.stringify({ sub: "user_42" })).toString("base64url")}.y`;

describe("cursor", () => {
  it("decodes the hex the state store hands back, and reads the user off the token", () => {
    expect(cursorTokenFromHex(Buffer.from(token).toString("hex"))).toBe(token);
    expect(cursorTokenFromHex(token)).toBe(token);
    expect(cursorTokenFromHex("  ")).toBeNull();
    expect(jwtSubject(token)).toBe("user_42");
    expect(jwtSubject("nope")).toBeNull();
  });

  it("maps the plan's percentage, or works it out from used and limit", () => {
    const direct = mapCursorUsage(
      {
        billingCycleEnd: "2026-09-01T00:00:00Z",
        individualUsage: { plan: { totalPercentUsed: 42.4 } },
      },
      now,
    );
    expect(direct.primaryPercent).toBe(42.4);
    expect(direct.buckets[0]).toMatchObject({
      label: "Plan usage",
      resetsAt: "2026-09-01T00:00:00.000Z",
    });
    const derived = mapCursorUsage(
      { individualUsage: { overall: { used: 150, limit: 500 } } },
      now,
    );
    expect(derived.primaryPercent).toBe(30);
    expect(mapCursorUsage({}, now).buckets).toEqual([]);
  });

  it("is not connected without a token, and sends the session as a cookie", async () => {
    const provider = createCursorProvider();
    expect((await provider.fetchSnapshot(context({}))).status).toBe(
      "unauthenticated",
    );

    let cookie = "";
    const snapshot = await provider.fetchSnapshot(
      context({
        runCommand: () => Promise.resolve(Buffer.from(token).toString("hex")),
        fetch: async (_url, init) => {
          cookie = new Headers(init?.headers).get("Cookie") ?? "";
          return new Response(
            JSON.stringify({
              individualUsage: { plan: { totalPercentUsed: 12 } },
            }),
          );
        },
      }),
    );
    expect(cookie).toBe(`WorkosCursorSessionToken=user_42%3A%3A${token}`);
    expect(snapshot.primaryPercent).toBe(12);
  });
});

describe("copilot", () => {
  it("reads the token from Copilot's own login file", () => {
    expect(
      copilotTokenFromApps(
        JSON.stringify({ "github.com:Iv1.abc": { oauth_token: "gho_x" } }),
      ),
    ).toBe("gho_x");
    expect(copilotTokenFromApps("{}")).toBeNull();
    expect(copilotTokenFromApps("garbage")).toBeNull();
  });

  it("turns percent remaining into percent used and skips unlimited quotas", () => {
    const snapshot = mapCopilotUsage(
      {
        quota_reset_date: "2026-09-01",
        quota_snapshots: {
          premium_interactions: { percent_remaining: 64.5 },
          chat: { unlimited: true, percent_remaining: 100 },
        },
      },
      now,
    );
    expect(snapshot.primaryPercent).toBe(35.5);
    expect(snapshot.buckets.map((b) => b.label)).toEqual(["Premium requests"]);
  });

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
