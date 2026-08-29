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

  it("keeps vertical docks clear of the menu bar", () => {
    const result = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    expect(result.slide.axis).toBe("y");
    expect(result.slide.min).toBe(display.workArea.y);
    expect(result.slide.max).toBe(
      display.workArea.y + display.workArea.height - result.height,
    );
    expect(result.y).toBeGreaterThanOrEqual(result.slide.min);
    expect(result.y).toBeLessThanOrEqual(result.slide.max);
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

  it("rides the physical screen bottom so it is level with the Dock", () => {
    const result = computePlacement("bottom-edge", chrome(), hud, PLACEMENT);
    expect(result.edge).toBe("bottom");
    expect(result.orientation).toBe("horizontal");
    // Below the work area, i.e. in the band the Dock occupies.
    expect(result.y + result.height).toBeGreaterThan(
      display.workArea.y + display.workArea.height,
    );
    expect(result.y + result.height).toBeLessThanOrEqual(
      display.bounds.y + display.bounds.height,
    );
  });

  it("parks the bottom dock clear of the centred macOS Dock", () => {
    const result = computePlacement("bottom-edge", chrome(), hud, PLACEMENT);
    const dockLeft =
      (display.bounds.width - PLACEMENT.dockCenteredIconSpanPx) / 2;
    const dockRight = dockLeft + PLACEMENT.dockCenteredIconSpanPx;
    const clearsLeft = result.x + result.width <= dockLeft;
    const clearsRight = result.x >= dockRight;
    expect(clearsLeft || clearsRight).toBe(true);
  });

  it("sits flush at the screen bottom when the Dock is hidden", () => {
    const noDock = chrome({
      display: {
        ...display,
        workArea: { x: 0, y: 25, width: 1440, height: 875 },
      },
    });
    const result = computePlacement("bottom-edge", noDock, hud, PLACEMENT);
    expect(result.y + result.height).toBe(
      display.bounds.y + display.bounds.height,
    );
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

  it("starts a non-notch top dock below the menu bar", () => {
    const result = computePlacement("top-edge", chrome(), hud, PLACEMENT, {
      notchAllowed: false,
    });
    expect(result.notch).toBe(false);
    expect(result.y).toBe(display.workArea.y);
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
