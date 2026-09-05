import {
  defaultSettings,
  hudMetrics,
  joinedNotchRailLength,
  virtualNotch,
} from "@capsule/config";
import { describe, expect, it } from "vitest";
import { computeDockPlacement } from "./overlay-placement.ts";

// A 4K external monitor with no notch of its own: the menu bar is 25px.
const monitor = {
  display: {
    id: 7,
    bounds: { x: 0, y: 0, width: 3840, height: 1620 },
    workArea: { x: 0, y: 25, width: 3840, height: 1595 },
  },
  dock: { orientation: "bottom" as const, autohide: false, tilesize: 48 },
};

describe("the top edge drawn as a notch", () => {
  const settings = {
    ...defaultSettings(),
    placementPreset: "top-edge" as const,
  };
  const m = hudMetrics(settings.hudScale);
  const notch = virtualNotch(m, monitor.display.workArea.y);

  it("hangs a menu-bar-deep, MacBook-wide notch from the centre of the top", () => {
    const placed = computeDockPlacement({
      settings,
      meterCount: 3,
      hardwareNotch: notch,
      preset: "top-edge",
      chrome: monitor,
      corner: null,
    });
    expect(notch).toEqual({ width: m.notchWidth, height: 25 });
    expect(placed.notch).toBe(true);
    expect(placed.y).toBe(0);
    // The rail is centred on the screen, whatever the window around it does.
    const railStart =
      placed.x + placed.slide.gutter + placed.railBias + m.notchBezelFillet;
    const railLength = joinedNotchRailLength(m, 3, notch);
    expect(railStart + railLength / 2).toBeCloseTo(
      monitor.display.bounds.width / 2,
      0,
    );
    expect(placed.slide.railLength).toBe(railLength + 2 * m.notchBezelFillet);
  });

  it("is deeper by the notch than a plain top bar, so readings clear the menu bar", () => {
    const plain = computeDockPlacement({
      settings,
      meterCount: 3,
      hardwareNotch: null,
      preset: "top-edge",
      chrome: monitor,
      corner: null,
    });
    const notched = computeDockPlacement({
      settings,
      meterCount: 3,
      hardwareNotch: notch,
      preset: "top-edge",
      chrome: monitor,
      corner: null,
    });
    expect(notched.height - plain.height).toBe(notch.height);
  });

  it("never draws a notch narrower than a MacBook's, even for one meter", () => {
    expect(joinedNotchRailLength(m, 1, notch)).toBeGreaterThanOrEqual(
      notch.width,
    );
  });
});
