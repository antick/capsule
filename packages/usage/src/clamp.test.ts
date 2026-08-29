import { describe, expect, it } from "vitest";
import { clampPercent, toPercent } from "./clamp.ts";

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

describe("toPercent", () => {
  it("treats 0-1 fractions as percents", () => {
    expect(toPercent(0.73)).toBe(73);
  });

  it("keeps already-percent values", () => {
    expect(toPercent(21)).toBe(21);
  });

  it("keeps a 1 percent value instead of treating it as 100", () => {
    expect(toPercent(1)).toBe(1);
  });
});
