import { describe, expect, it } from "vitest";
import { formatBytes } from "./updates.ts";

/**
 * Update wording, sizes, release URLs, release notes and the update state
 * helpers are in the fixture corpus; see `state-fixtures.test.ts`. What stays
 * is the one input JSON cannot carry.
 */
describe("formatBytes", () => {
  it("refuses to render a size that is not a number", () => {
    expect(formatBytes(Number.NaN)).toBe("0 MB");
  });
});
