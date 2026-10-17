import { BACKOFF } from "@capsule/config";
import { frozenNow, loadCases, loadFixture } from "@capsule/fixtures";
import { describe, expect, it } from "vitest";
import { backoffMs, retryAfterMs } from "./backoff.ts";

describe("backoffMs", () => {
  // The fixtures hold literal milliseconds so a Swift suite can read them.
  // That only stays honest while the literals agree with the constants the
  // app actually backs off by, so check that before trusting the cases.
  it("fixture literals still match the configured floor and ceiling", () => {
    expect(BACKOFF.floorMs).toBe(60_000);
    expect(BACKOFF.ceilingMs).toBe(900_000);
  });

  for (const testCase of loadCases<
    { refusals: number; retryAfterMs: number | null },
    number
  >("usage/backoff")) {
    it(testCase.name, () => {
      expect(
        backoffMs(testCase.input.refusals, testCase.input.retryAfterMs),
      ).toBe(testCase.expected);
    });
  }
});

describe("retryAfterMs", () => {
  const file = loadFixture<{ header: string | null }, number | null>(
    "usage/retry-after",
  );
  const now = frozenNow(file);

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      expect(retryAfterMs(testCase.input.header, now)).toBe(testCase.expected);
    });
  }
});
