import { describe, expect, it } from "vitest";
import {
  COLUMN_SEPARATOR,
  parsePsStart,
  parseSqliteRows,
} from "./activity-host.ts";

describe("parsePsStart", () => {
  it("reads ps's space-padded local start time", () => {
    const parsed = parsePsStart("Sat Sep  5 23:05:22 2026    \n");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(5);
    expect(parsed?.getHours()).toBe(23);
    expect(parsePsStart("")).toBeNull();
  });
});

describe("parseSqliteRows", () => {
  it("splits rows on newlines and columns on the unit separator", () => {
    const out = `a${COLUMN_SEPARATOR}b\nc${COLUMN_SEPARATOR}d\n`;
    expect(parseSqliteRows(out)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseSqliteRows("")).toEqual([]);
  });
});
