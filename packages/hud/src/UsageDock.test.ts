import {
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
    // The latch is always in the markup; retracting is what makes it show.
    expect(stowed).toContain('data-hud-latch="true"');
    expect(stowed).toContain('data-hud-hit="true"');
    expect(stowed).toContain("opacity:1");
    expect(shown).toContain('data-hud-latch="true"');
    expect(shown).toContain("opacity:0");
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
