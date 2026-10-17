import { type FixtureFile, frozenNow, loadFixture } from "@capsule/fixtures";
import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatElapsed,
  formatResetAbsolute,
  formatResetCopy,
  formatResetRelative,
} from "./index.ts";

/** A case whose `since` is given as a distance back from `frozenNow`. */
interface SpanInput {
  msBeforeNow: number;
}

function spanCases(path: string): [FixtureFile<SpanInput, string>, Date] {
  const file = loadFixture<SpanInput, string>(path);
  return [file, frozenNow(file)];
}

describe("formatResetRelative", () => {
  const file = loadFixture<{ resetsAt: string }, string>(
    "dates/reset-relative",
  );
  const now = frozenNow(file);

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      expect(formatResetRelative(new Date(testCase.input.resetsAt), now)).toBe(
        testCase.expected,
      );
    });
  }
});

describe("formatResetAbsolute", () => {
  const file = loadFixture<{ resetsAt: string }, string>(
    "dates/reset-absolute",
  );
  const now = frozenNow(file);

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      expect(
        formatResetAbsolute(
          new Date(testCase.input.resetsAt),
          file.locale ?? "en-US",
          now,
        ),
      ).toBe(testCase.expected);
    });
  }
});

describe("formatElapsed", () => {
  const [file, now] = spanCases("dates/elapsed");

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      const since = new Date(now.getTime() - testCase.input.msBeforeNow);
      expect(formatElapsed(since, now)).toBe(testCase.expected);
    });
  }
});

describe("formatAgo", () => {
  const [file, now] = spanCases("dates/ago");

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      const since = new Date(now.getTime() - testCase.input.msBeforeNow);
      expect(formatAgo(since, now)).toBe(testCase.expected);
    });
  }
});

describe("formatResetCopy", () => {
  // Not a fixture case: the assertion is a shape, not a value, so there is
  // nothing for a Swift suite to compare against.
  it("uses relative style under 24 hours", () => {
    const now = new Date("2026-08-27T11:22:00Z");
    expect(
      formatResetCopy("2026-08-27T12:13:00.000Z", "relative", now, "en-US"),
    ).toMatch(/^Resets in /);
  });
});
