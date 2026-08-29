import { describe, expect, it } from "vitest";
import { PLACEMENT } from "./constants.ts";
import { hudMetrics } from "./metrics.ts";
import {
  type ChromeSnapshot,
  computePlacement,
  type HudSize,
} from "./placement.ts";

const m = hudMetrics(1);

const display = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  // 25px menu bar at the top, 75px Dock at the bottom.
  workArea: { x: 0, y: 25, width: 1440, height: 800 },
};

const hud: HudSize = {
  railWidth: m.railWidth,
  railLength: 280,
  cardWidth: m.cardWidth,
  cardHeight: 168,
  expanded: false,
  shadowPadding: m.shadowPadding,
  joinWidth: m.tailLength + m.joinGap,
  edgeFlare: m.edgeFlare,
  edgeGap: 0,
};

const chrome = (overrides: Partial<ChromeSnapshot> = {}): ChromeSnapshot => ({
  display,
  dock: { orientation: "bottom", autohide: false, tilesize: 48 },
  ...overrides,
});

describe("computePlacement", () => {
  it("puts right-edge flush against the display right", () => {
    const result = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    expect(result.edge).toBe("right");
    expect(result.orientation).toBe("vertical");
    expect(result.cardGrowth).toBe("left");
    expect(result.notch).toBe(false);
    expect(result.x + result.width).toBe(display.bounds.width);
  });

  it("puts left-edge flush against the display left", () => {
    const result = computePlacement("left-edge", chrome(), hud, PLACEMENT);
    expect(result.x).toBe(0);
    expect(result.cardGrowth).toBe("right");
    expect(result.orientation).toBe("vertical");
  });

  it("lets a vertical dock ride the whole physical edge", () => {
    // Stopping at the work area would leave the dock hovering above the macOS
    // Dock with a band of desktop showing beneath it.
    const result = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    expect(result.slide.axis).toBe("y");
    expect(result.slide.min).toBe(display.bounds.y);
    expect(result.slide.max + result.slide.railLength).toBe(
      display.bounds.y + display.bounds.height,
    );
  });

  it("centres a vertical dock on the space the menu bar leaves", () => {
    const result = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    const railTop = result.y + result.slide.gutter + result.railBias;
    expect(railTop).toBe(
      Math.round(
        display.workArea.y +
          (display.workArea.height - result.slide.railLength) / 2,
      ),
    );
  });

  it("hangs the top edge from the physical screen top as a notch", () => {
    const result = computePlacement("top-edge", chrome(), hud, PLACEMENT);
    expect(result.notch).toBe(true);
    expect(result.orientation).toBe("horizontal");
    expect(result.cardGrowth).toBe("down");
    // Over the menu bar, not below it.
    expect(result.y).toBe(display.bounds.y);
    expect(result.y).toBeLessThan(display.workArea.y);
    expect(result.slide.axis).toBe("x");
  });

  it("rides the physical screen bottom, not the top of the Dock", () => {
    // The Dock here is 75px tall and the HUD is thinner than that. Aligning
    // the two by their tops would strand the HUD above the screen edge with a
    // band of empty desktop under it.
    const result = computePlacement("bottom-edge", chrome(), hud, PLACEMENT);
    expect(result.edge).toBe("bottom");
    expect(result.orientation).toBe("horizontal");
    expect(result.height).toBeLessThan(
      display.bounds.height - display.workArea.height,
    );
    expect(result.y + result.height).toBe(
      display.bounds.y + display.bounds.height,
    );
  });

  it("parks the bottom dock clear of the centred macOS Dock", () => {
    const result = computePlacement("bottom-edge", chrome(), hud, PLACEMENT);
    const dockLeft =
      (display.bounds.width - PLACEMENT.dockCenteredIconSpanPx) / 2;
    const dockRight = dockLeft + PLACEMENT.dockCenteredIconSpanPx;
    // What must clear the Dock is the rail, not the transparent window.
    const railLeft = result.x + result.slide.gutter + result.railBias;
    const railRight = railLeft + result.slide.railLength;
    expect(railRight <= dockLeft || railLeft >= dockRight).toBe(true);
  });

  it("centres on the bottom edge when no Dock is sharing it", () => {
    for (const dock of [
      { orientation: "left", autohide: false, tilesize: 48 },
      { orientation: "bottom", autohide: true, tilesize: 48 },
    ] as const) {
      const result = computePlacement(
        "bottom-edge",
        chrome({ dock }),
        hud,
        PLACEMENT,
      );
      const railLeft = result.x + result.slide.gutter + result.railBias;
      expect(railLeft).toBe(
        Math.round((display.bounds.width - result.slide.railLength) / 2),
      );
    }
  });

  it("holds a detached style clear of the edge it is docked against", () => {
    const gap = 12;
    const flush = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    const detached = computePlacement(
      "right-edge",
      chrome(),
      { ...hud, edgeGap: gap },
      PLACEMENT,
    );
    expect(detached.width).toBe(flush.width + gap);
    // The window still meets the screen edge; the gap lives inside it.
    expect(detached.x + detached.width).toBe(display.bounds.width);
  });

  it("hangs a floating style from the physical top too", () => {
    // It is drawn as a pill rather than a notch, but it still starts at the
    // top of the screen and covers the menu bar; only its own edge gap holds
    // it off. Starting at the work area instead made the top dock look like it
    // had slipped down whenever the style changed.
    const result = computePlacement("top-edge", chrome(), hud, PLACEMENT, {
      notchAllowed: false,
    });
    expect(result.notch).toBe(false);
    expect(result.y).toBe(display.bounds.y);
  });

  it("lets a horizontal dock reach both corners of its edge", () => {
    for (const preset of ["top-edge", "bottom-edge"] as const) {
      const result = computePlacement(preset, chrome(), hud, PLACEMENT, {
        notchAllowed: false,
      });
      expect(result.slide.min).toBe(display.bounds.x);
      expect(result.slide.max + result.slide.railLength).toBe(
        display.bounds.x + display.bounds.width,
      );
    }
  });

  it("grows the window inward when expanded on the right edge", () => {
    const collapsed = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    const expanded = computePlacement(
      "right-edge",
      chrome(),
      { ...hud, expanded: true },
      PLACEMENT,
    );
    expect(expanded.width).toBeGreaterThan(collapsed.width);
    expect(expanded.x + expanded.width).toBe(display.bounds.width);
  });
});
