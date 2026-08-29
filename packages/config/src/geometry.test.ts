import { describe, expect, it } from "vitest";
import {
  HUD_BASE,
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  PLACEMENT_PRESETS,
} from "./constants.ts";
import {
  cardHeightForBuckets,
  cardMessageHeight,
  clampHudScale,
  HUD_SCALE,
  hudMetrics,
  hudScaleSteps,
  joinOffsetForIndex,
  meterBlockSize,
  meterStrideSize,
  nextHudScale,
  railLengthForCount,
} from "./metrics.ts";

const m = hudMetrics(1);

describe("rail geometry", () => {
  it("stacks meters with padding between and around them", () => {
    expect(meterBlockSize(m)).toBe(
      m.meterSize + m.meterLabelGap + m.percentBlock,
    );
    expect(railLengthForCount(m, 3)).toBe(
      m.railPaddingY * 2 + 3 * meterBlockSize(m) + 2 * m.itemGap,
    );
  });

  it("centres the join on each meter ring", () => {
    expect(joinOffsetForIndex(m, 0)).toBe(m.railPaddingY + m.meterSize / 2);
    expect(joinOffsetForIndex(m, 1) - joinOffsetForIndex(m, 0)).toBe(
      meterStrideSize(m),
    );
    const last = joinOffsetForIndex(m, 2) + m.meterSize / 2;
    expect(last).toBeLessThan(railLengthForCount(m, 3));
  });

  it("drops the percent caption and tightens padding in compact mode", () => {
    expect(meterBlockSize(m, true)).toBe(m.meterSize);
    expect(railLengthForCount(m, 3, true)).toBeLessThan(
      railLengthForCount(m, 3),
    );
    expect(joinOffsetForIndex(m, 0, true)).toBe(
      m.notchPaddingY + m.meterSize / 2,
    );
  });

  it("fits a compact meter inside the rail's thickness at every size", () => {
    // A horizontal dock lays meters across the rail's short axis, so anything
    // taller than the rail spills out onto the desktop.
    for (
      let scale = HUD_SCALE.min;
      scale <= HUD_SCALE.max + 1e-9;
      scale += HUD_SCALE.step
    ) {
      const metrics = hudMetrics(scale);
      expect(
        meterBlockSize(metrics, true) + metrics.railPaddingX * 2,
      ).toBeLessThanOrEqual(metrics.railWidth);
    }
  });
});

describe("card sizing", () => {
  it("grows by one row per usage bucket", () => {
    const one = cardHeightForBuckets(m, 1);
    const two = cardHeightForBuckets(m, 2);
    expect(two - one).toBe(
      m.cardTextLine * 2 + m.cardBucketGap * 2 + m.barHeight + m.cardSectionGap,
    );
    expect(cardMessageHeight(m)).toBeLessThan(one);
  });
});

describe("hud scale", () => {
  it("clamps to the supported range and snaps to the step", () => {
    expect(clampHudScale(99)).toBe(HUD_SCALE.max);
    expect(clampHudScale(-1)).toBe(HUD_SCALE.min);
    expect(clampHudScale(Number.NaN)).toBe(HUD_SCALE.default);
    expect(clampHudScale(0.823)).toBe(0.8);
  });

  it("steps up and down without escaping the range", () => {
    expect(nextHudScale(HUD_SCALE.max, 1)).toBe(HUD_SCALE.max);
    expect(nextHudScale(HUD_SCALE.min, -1)).toBe(HUD_SCALE.min);
    expect(nextHudScale(0.8, 1)).toBe(0.9);
    expect(nextHudScale(0.8, -1)).toBe(0.7);
  });

  it("offers three steps down and three up from the shipped size", () => {
    const steps = hudScaleSteps();
    expect(steps).toEqual([0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]);
    expect(steps.indexOf(HUD_SCALE.default)).toBe(3);
    expect(steps.length - 1 - steps.indexOf(HUD_SCALE.default)).toBe(3);
  });

  it("shrinks every dimension together, and never to nothing", () => {
    const small = hudMetrics(HUD_SCALE.min);
    const large = hudMetrics(HUD_SCALE.max);
    expect(small.meterSize).toBeLessThan(large.meterSize);
    expect(small.cardWidth).toBeLessThan(large.cardWidth);
    expect(small.railWidth).toBeLessThan(large.railWidth);
    expect(small.ringStroke).toBeGreaterThanOrEqual(1);
  });

  it("draws the artwork at its authored size when set to 100%", () => {
    const shipped = hudMetrics(HUD_SCALE.default);
    expect(shipped.scale).toBe(1);
    expect(shipped.unit).toBe(1);
    expect(shipped.railWidth).toBe(HUD_BASE.railWidth);
    expect(shipped.cardWidth).toBe(HUD_BASE.cardWidth);
  });

  it("keeps the whole dock narrower than a sliver of a laptop screen", () => {
    // The dock is a passenger on the desktop, not a sidebar: at full size it
    // still has to read as an accessory rather than a panel.
    const largest = hudMetrics(HUD_SCALE.max);
    expect(largest.railWidth).toBeLessThan(90);
    expect(railLengthForCount(largest, 3)).toBeLessThan(300);
  });
});

describe("placement copy", () => {
  it("labels and explains every preset", () => {
    for (const preset of PLACEMENT_PRESETS) {
      expect(PLACEMENT_LABELS[preset].length).toBeGreaterThan(0);
      expect(PLACEMENT_HINTS[preset].length).toBeGreaterThan(0);
    }
  });
});
