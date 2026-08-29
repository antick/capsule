import { describe, expect, it } from "vitest";
import {
  HUD,
  joinOffsetForIndex,
  meterBlockSize,
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
