import { loadCases } from "@capsule/fixtures";
import { describe, expect, it } from "vitest";
import type { Severity } from "./constants.ts";
import { severityForPercent } from "./severity.ts";

describe("severityForPercent", () => {
  for (const testCase of loadCases<number, Severity>("severity/for-percent")) {
    it(`${testCase.name} (${testCase.input})`, () => {
      expect(severityForPercent(testCase.input)).toBe(testCase.expected);
    });
  }
});
