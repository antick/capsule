import { defaultSettings, type UsageSnapshot } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { rememberedSnapshots } from "../poller.ts";

const now = new Date("2026-08-27T11:22:00.000Z");

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
