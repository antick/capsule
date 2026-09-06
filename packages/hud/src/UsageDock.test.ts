import {
  type AgentSession,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  DOCK_STYLES,
  HUD_THEMES,
} from "@capsule/config";
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

  it("chases the ring of a provider that is being refreshed, and only that one", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS.map((item, index) =>
          index === 0 ? { ...item, refreshing: true } : item,
        ),
        orientation: "vertical",
        cardGrowth: "left",
        now: new Date(DEMO_NOW_ISO),
      }),
    );
    expect(html.match(/data-hud-sweep/g)).toHaveLength(1);
    // The real number stays put underneath the sweep.
    expect(html).toContain("73%");
  });

  it("rests as a latch when auto-hide is on, and shows the rail when it is off", () => {
    const stowed = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now: new Date(DEMO_NOW_ISO),
        autoHide: true,
      }),
    );
    const shown = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now: new Date(DEMO_NOW_ISO),
        autoHide: false,
      }),
    );
    // Only the latch's band answers the mouse while the dock rests.
    expect(stowed).toContain('data-hud-latch="true" data-hud-hit="true"');
    expect(shown).not.toContain('data-hud-latch="true" data-hud-hit="true"');
    // The rail is one shape in both states, folded down to a sliver at rest,
    // and the meters are masked by that same outline.
    const railOf = (html: string) =>
      html.match(/data-hud-rail-shape="true"[^>]*>.*?<path d="([^"]+)"/s)?.[1];
    expect(railOf(stowed)).toBeDefined();
    expect(railOf(stowed)).not.toBe(railOf(shown));
    expect(stowed).toContain("clip-path:path(");
    expect(shown).not.toContain("clip-path:path(");
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

  it("clearly labels disabled usage without suggesting login or showing a number", () => {
    const previous = DEMO_SNAPSHOTS[0];
    if (!previous) throw new Error("Missing demo snapshot");
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [
          {
            ...previous,
            status: "disabled",
            primaryPercent: null,
            buckets: [],
          },
        ],
        orientation: "vertical",
        cardGrowth: "left",
        forceOpenProviderId: "claude",
      }),
    );
    expect(html).toContain("Live usage disabled");
    expect(html).not.toContain("Not connected");
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

  it("drops the percent captions when the dock lies along an edge", () => {
    const horizontal = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "horizontal",
        cardGrowth: "up",
        now: new Date(DEMO_NOW_ISO),
      }),
    );
    expect(horizontal).not.toContain(">73%<");
    expect(horizontal).toContain('data-provider="claude"');

    const vertical = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now: new Date(DEMO_NOW_ISO),
      }),
    );
    expect(vertical).toContain(">73%<");
  });

  it("paints the chosen theme onto the surface and the type", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        theme: HUD_THEMES.porcelain,
        now: new Date(DEMO_NOW_ISO),
        forceOpenProviderId: "claude",
      }),
    );
    expect(html).toContain(`fill="${HUD_THEMES.porcelain.surface}"`);
    expect(html).toContain(HUD_THEMES.porcelain.textMuted);
    expect(html).not.toContain('fill="#000000"');
  });

  it("outlines the tray style and leaves the rail style unoutlined", () => {
    const render = (
      dockStyle: (typeof DOCK_STYLES)[keyof typeof DOCK_STYLES],
    ) =>
      renderToStaticMarkup(
        createElement(UsageDock, {
          snapshots: DEMO_SNAPSHOTS,
          orientation: "vertical",
          cardGrowth: "left",
          dockStyle,
          now: new Date(DEMO_NOW_ISO),
        }),
      );
    // The hairline is the only 1px stroke; meter rings are far thicker.
    expect(render(DOCK_STYLES.tray)).toContain('stroke-width="1"');
    expect(render(DOCK_STYLES.rail)).not.toContain('stroke-width="1"');
  });
});

describe("UsageDock activity", () => {
  const now = new Date(DEMO_NOW_ISO);
  const busy: AgentSession = {
    id: "claude.1",
    providerId: "claude",
    name: "egglify-4e",
    detail: "Desktop - egglify",
    state: "busy",
    waitingFor: null,
    since: new Date(now.getTime() - 3 * 60_000).toISOString(),
  };

  it("marks a ring whose agent is working and lists the session in its card", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now,
        activity: { claude: [busy] },
        forceOpenProviderId: "claude",
      }),
    );
    expect(html.match(/data-hud-activity="working"/g)).toHaveLength(1);
    expect(html).toContain('data-session-list="true"');
    expect(html).toContain("egglify-4e");
    expect(html).toContain('data-hud-status="busy"');
    expect(html).toContain("working");
    expect(html).toContain("3 min");
  });

  it("breathes amber, and leads with what it wants, when an agent waits on you", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now,
        activity: {
          claude: [
            { ...busy, state: "waiting", waitingFor: "Allow the edit?" },
          ],
        },
        forceOpenProviderId: "claude",
      }),
    );
    expect(html).toContain('data-hud-activity="waiting"');
    expect(html).toContain("Allow the edit?");
    expect(html).not.toContain("Desktop - egglify");
  });

  it("dates a stale reading in the card header", () => {
    const stale = DEMO_SNAPSHOTS.map((item, index) =>
      index === 0
        ? {
            ...item,
            status: "stale" as const,
            staleSince: new Date(now.getTime() - 12 * 60_000).toISOString(),
          }
        : item,
    );
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: stale,
        orientation: "vertical",
        cardGrowth: "left",
        now,
        forceOpenProviderId: "claude",
      }),
    );
    expect(html).toContain('data-reading-age="true"');
    expect(html).toContain("12 min ago");
  });

  it("stays unrolled while asked to keep open", () => {
    const held = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        orientation: "vertical",
        cardGrowth: "left",
        now,
        autoHide: true,
        keepOpen: true,
      }),
    );
    expect(held).not.toContain("clip-path:path(");
  });
});
