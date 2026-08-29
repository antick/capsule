import { describe, expect, it } from "vitest";
import {
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

  it("drops the percent caption and tightens padding in notch mode", () => {
    expect(meterBlockSize(m, true)).toBe(m.meterSize);
    expect(railLengthForCount(m, 3, true)).toBeLessThan(
      railLengthForCount(m, 3),
    );
    expect(joinOffsetForIndex(m, 0, true)).toBe(
      m.notchPaddingY + m.meterSize / 2,
    );
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
    expect(nextHudScale(0.8, 1)).toBe(0.85);
    expect(nextHudScale(0.8, -1)).toBe(0.75);
  });

  it("shrinks every dimension together, and never to nothing", () => {
    const small = hudMetrics(HUD_SCALE.min);
    const large = hudMetrics(HUD_SCALE.max);
    expect(small.meterSize).toBeLessThan(large.meterSize);
    expect(small.cardWidth).toBeLessThan(large.cardWidth);
    expect(small.railWidth).toBeLessThan(large.railWidth);
    expect(small.ringStroke).toBeGreaterThanOrEqual(1);
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
