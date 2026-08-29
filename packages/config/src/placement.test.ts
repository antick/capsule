import { describe, expect, it } from "vitest";
import { HUD, PLACEMENT } from "./constants.ts";
import {
  type ChromeSnapshot,
  computePlacement,
  type HudSize,
} from "./placement.ts";

const display = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  workArea: { x: 0, y: 25, width: 1440, height: 800 },
};

const hud: HudSize = {
  railWidth: HUD.railWidth,
  railLength: 280,
  cardWidth: HUD.cardWidth,
  cardHeight: 168,
  expanded: false,
  shadowPadding: HUD.shadowPadding,
  joinWidth: HUD.joinWidth,
};

const chrome = (overrides: Partial<ChromeSnapshot> = {}): ChromeSnapshot => ({
  display,
  dock: { orientation: "bottom", autohide: false, tilesize: 48 },
  stageManagerEnabled: false,
  ...overrides,
});

describe("computePlacement", () => {
  it("defaults right-edge flush to the display right", () => {
    const result = computePlacement("right-edge", chrome(), hud, PLACEMENT);
    expect(result.edge).toBe("right");
    expect(result.orientation).toBe("vertical");
    expect(result.cardGrowth).toBe("left");
    expect(result.x + result.width).toBe(display.bounds.width);
    expect(result.y).toBeGreaterThanOrEqual(display.workArea.y);
  });

  it("places left-edge flush to the display left", () => {
    const result = computePlacement("left-edge", chrome(), hud, PLACEMENT);
    expect(result.x).toBe(0);
    expect(result.cardGrowth).toBe("right");
    expect(result.orientation).toBe("vertical");
  });

  it("falls back to left-edge when Stage Manager is off", () => {
    const result = computePlacement(
      "stage-manager-bottom",
      chrome({ stageManagerEnabled: false }),
      hud,
      PLACEMENT,
    );
    expect(result.visualPreset).toBe("left-edge");
    expect(result.x).toBe(0);
  });

  it("uses the left strip when Stage Manager is on", () => {
    const result = computePlacement(
      "stage-manager-bottom",
      chrome({ stageManagerEnabled: true }),
      hud,
      PLACEMENT,
    );
    expect(result.visualPreset).toBe("stage-manager-bottom");
    expect(result.x).toBeLessThan(PLACEMENT.stageManagerStripWidthPx);
    expect(result.y + result.height).toBeLessThanOrEqual(
      display.workArea.y + display.workArea.height,
    );
  });

  it("places a horizontal rail in the right Dock flank", () => {
    const result = computePlacement(
      "dock-flank-right",
      chrome(),
      hud,
      PLACEMENT,
    );
    expect(result.orientation).toBe("horizontal");
    expect(result.edge).toBe("bottom");
    expect(result.x + result.width).toBeLessThanOrEqual(
      display.workArea.x + display.workArea.width,
    );
    expect(result.y + result.height).toBeLessThanOrEqual(
      display.workArea.y + display.workArea.height,
    );
  });

  it("places a horizontal rail in the left Dock flank", () => {
    const result = computePlacement(
      "dock-flank-left",
      chrome(),
      hud,
      PLACEMENT,
    );
    expect(result.orientation).toBe("horizontal");
    expect(result.x).toBeGreaterThanOrEqual(display.workArea.x);
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
