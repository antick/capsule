import { loadCases, loadFixture } from "@capsule/fixtures";
import { describe, expect, it } from "vitest";
import { dayKey, formatCompactCount, startOfDay } from "./tokens.ts";

describe("formatCompactCount", () => {
  for (const testCase of loadCases<number, string>("activity/compact-count")) {
    it(`${testCase.name} (${testCase.input})`, () => {
      expect(formatCompactCount(testCase.input)).toBe(testCase.expected);
    });
  }
});

describe("day keys", () => {
  const file = loadFixture<{ now: string; daysBack: number }, string>(
    "dates/day-keys",
  );

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      const now = new Date(testCase.input.now);
      expect(dayKey(startOfDay(now, testCase.input.daysBack))).toBe(
        testCase.expected,
      );
    });
  }

  // Not a fixture case: a property of every result rather than one mapping.
  it("starts a day at midnight", () => {
    expect(startOfDay(new Date("2026-09-06T23:59:00Z")).getHours()).toBe(0);
  });
});
