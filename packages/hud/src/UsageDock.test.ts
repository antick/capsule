import { DEMO_NOW_ISO, DEMO_SNAPSHOTS } from "@capsule/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UsageDock } from "./UsageDock.tsx";

describe("UsageDock", () => {
  it("renders the reference percents and Claude card copy", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now: new Date(DEMO_NOW_ISO),
        forceOpenProviderId: "claude",
      }),
    );
    expect(html).toContain("73%");
    expect(html).toContain("21%");
    expect(html).toContain("52%");
    expect(html).toContain("Claude Usage");
    expect(html).toContain("Current session");
    expect(html).toContain("All models");
    expect(html).toContain("73% Used");
    expect(html).toContain("7% Used");
    expect(html).toContain("Resets in 51 min");
    expect(html).toContain("data-hud-rail-shape");
    expect(html).toContain('data-hud-bubble="true"');
    expect(html).toContain('data-card-open="true"');
    expect(html.includes("0% Used")).toBe(false);
  });

  it("does not invent 0% Used for unauthenticated providers", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [
          {
            providerId: "codex",
            displayName: "Codex",
            iconId: "codex",
            status: "unauthenticated",
            primaryPercent: null,
            buckets: [],
            fetchedAt: new Date().toISOString(),
          },
        ],
        orientation: "vertical",
        cardGrowth: "left",
        forceOpenProviderId: "codex",
      }),
    );
    expect(html).toContain("Not connected");
    expect(html).not.toContain("0% Used");
  });

  it("still paints Claude, Codex, and Grok meters when snapshots are empty", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [],
        orientation: "vertical",
        cardGrowth: "left",
      }),
    );
    expect(html).toContain('data-provider="claude"');
    expect(html).toContain('data-provider="codex"');
    expect(html).toContain('data-provider="grok"');
    expect(html).toContain("—");
  });
});
