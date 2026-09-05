import { describe, expect, it } from "vitest";
import {
  HUD,
  HUD_BASE,
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  PLACEMENT_PRESETS,
} from "./constants.ts";
import {
  cardHeightFor,
  cardHeightForBuckets,
  cardMessageHeight,
  cardReserveHeight,
  clampHudScale,
  HUD_SCALE,
  hudMetrics,
  hudScaleSteps,
  joinedNotchRailLength,
  joinOffsetForIndex,
  meterBlockSize,
  meterStrideSize,
  nextHudScale,
  railEndSpread,
  railLengthForCount,
  sessionRowsShown,
  virtualNotch,
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

  it("draws the sizes between two steps, so a resize can ease through them", () => {
    // Settings only ever store a step, but the dock eases between them on a
    // resize. Snapping here would turn that into a seven-frame staircase.
    const widths = new Set<number>();
    for (let scale = 1; scale <= 1.1 + 1e-9; scale += 0.01) {
      widths.add(hudMetrics(scale).railWidth);
    }
    expect(widths.size).toBeGreaterThan(2);
    expect(hudMetrics(99).railWidth).toBe(hudMetrics(HUD_SCALE.max).railWidth);
    expect(hudMetrics(Number.NaN).railWidth).toBe(
      hudMetrics(HUD_SCALE.default).railWidth,
    );
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

describe("card height with sessions", () => {
  it("adds a rule and two-line rows for live sessions", () => {
    const bare = cardHeightFor(m, { buckets: 2 });
    const one = cardHeightFor(m, { buckets: 2, sessions: 1 });
    const two = cardHeightFor(m, { buckets: 2, sessions: 2 });
    expect(bare).toBe(cardHeightForBuckets(m, 2));
    expect(one - bare).toBe(
      m.cardRuleGap * 2 + m.cardRule + m.cardTextLine * 2 + m.cardBucketGap,
    );
    expect(two - one).toBe(
      m.cardSectionGap + m.cardTextLine * 2 + m.cardBucketGap,
    );
  });

  it("stops growing at the cap and adds one line to count the rest", () => {
    const capped = cardHeightFor(m, {
      buckets: 2,
      sessions: HUD.maxCardSessions,
    });
    const over = cardHeightFor(m, {
      buckets: 2,
      sessions: HUD.maxCardSessions + 3,
    });
    expect(over - capped).toBe(m.cardSectionGap + m.cardTextLine);
    // The reserve holds the busiest provider with a list that had to be cut.
    expect(cardReserveHeight(m)).toBeGreaterThan(
      cardHeightForBuckets(m, HUD.maxCardBuckets),
    );
    expect(sessionRowsShown(HUD.maxCardSessions + 3)).toEqual({
      rows: HUD.maxCardSessions,
      hidden: 3,
    });
  });
});

describe("joined notch rail", () => {
  const notch = { width: 200, height: 32 };

  it("is never narrower than the hardware plus a corner each side", () => {
    expect(joinedNotchRailLength(m, 1, notch)).toBe(
      notch.width + 2 * m.notchRadius,
    );
    expect(joinedNotchRailLength(m, 3, notch)).toBeGreaterThanOrEqual(
      railLengthForCount(m, 3, true),
    );
  });

  it("spreads the surplus evenly so the meters stay centred", () => {
    const length = joinedNotchRailLength(m, 1, notch);
    expect(railEndSpread(m, 1, true, length)).toBe(
      (length - railLengthForCount(m, 1, true)) / 2,
    );
    expect(railEndSpread(m, 3, false, railLengthForCount(m, 3))).toBe(0);
  });
});

describe("virtualNotch", () => {
  it("is a MacBook's width and exactly the menu bar's height", () => {
    expect(virtualNotch(m, 25)).toEqual({ width: m.notchWidth, height: 25 });
  });

  it("falls back to its own depth when there is no menu bar to measure", () => {
    expect(virtualNotch(m, 0)).toEqual({
      width: m.notchWidth,
      height: m.notchDepth,
    });
  });
});
