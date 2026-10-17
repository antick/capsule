import { loadCases } from "@capsule/fixtures";
import { describe, expect, it } from "vitest";
import { clampPercent, toPercent } from "./clamp.ts";

describe("clampPercent", () => {
  for (const testCase of loadCases<number, number>("usage/clamp-percent")) {
    it(testCase.name, () => {
      expect(clampPercent(testCase.input)).toBe(testCase.expected);
    });
  }
});

describe("toPercent", () => {
  for (const testCase of loadCases<number, number>("usage/to-percent")) {
    it(testCase.name, () => {
      expect(toPercent(testCase.input)).toBe(testCase.expected);
    });
  }
});
