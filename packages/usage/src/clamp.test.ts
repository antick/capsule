import { describe, expect, it } from "vitest";
import { clampPercent } from "./clamp.ts";

describe("clampPercent", () => {
  it("clamps 112 to 100", () => {
    expect(clampPercent(112)).toBe(100);
  });

  it("clamps negatives to 0", () => {
    expect(clampPercent(-4)).toBe(0);
  });

  it("passes through in-range values", () => {
    expect(clampPercent(73)).toBe(73);
  });
});
