import { describe, expect, it } from "vitest";
import {
  HUD,
  joinOffsetForIndex,
  meterBlockSize,
  PLACEMENT_LABELS,
  PLACEMENT_MENU_GROUPS,
  PLACEMENT_PRESETS,
  railLengthForCount,
} from "./constants.ts";

describe("rail geometry", () => {
  it("stacks meters with padding and gaps", () => {
    const length = railLengthForCount(3);
    expect(length).toBe(
      HUD.railPaddingY * 2 + 3 * meterBlockSize() - HUD.itemGap,
    );
    expect(joinOffsetForIndex(0)).toBe(HUD.railPaddingY + HUD.meterSize / 2);
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
