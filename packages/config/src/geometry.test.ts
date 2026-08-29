import { describe, expect, it } from "vitest";
import {
  cardHeightForBuckets,
  cardMessageHeight,
  HUD,
  joinOffsetForIndex,
  meterBlockSize,
  meterStrideSize,
  PLACEMENT_LABELS,
  PLACEMENT_MENU_GROUPS,
  PLACEMENT_PRESETS,
  railLengthForCount,
} from "./constants.ts";

describe("rail geometry", () => {
  it("stacks meters with padding between and around them", () => {
    expect(meterBlockSize()).toBe(
      HUD.meterSize + HUD.meterLabelGap + HUD.percentBlock,
    );
    expect(railLengthForCount(3)).toBe(
      HUD.railPaddingY * 2 + 3 * meterBlockSize() + 2 * HUD.itemGap,
    );
  });

  it("centres the join on each meter ring", () => {
    expect(joinOffsetForIndex(0)).toBe(HUD.railPaddingY + HUD.meterSize / 2);
    expect(joinOffsetForIndex(1) - joinOffsetForIndex(0)).toBe(
      meterStrideSize(),
    );
    const last = joinOffsetForIndex(2) + HUD.meterSize / 2;
    expect(last).toBeLessThan(railLengthForCount(3));
  });
});

describe("card sizing", () => {
  it("grows by one row per usage bucket", () => {
    const one = cardHeightForBuckets(1);
    const two = cardHeightForBuckets(2);
    expect(two - one).toBe(
      HUD.cardTextLine * 2 +
        HUD.cardBucketGap * 2 +
        HUD.barHeight +
        HUD.cardSectionGap,
    );
    expect(cardMessageHeight()).toBeLessThan(one);
  });
});

describe("placement menu copy", () => {
  it("labels every preset used in the menu", () => {
    const grouped = PLACEMENT_MENU_GROUPS.flat();
    expect([...grouped].sort()).toEqual([...PLACEMENT_PRESETS].sort());
    for (const preset of PLACEMENT_PRESETS) {
      expect(PLACEMENT_LABELS[preset].length).toBeGreaterThan(0);
    }
  });
});
