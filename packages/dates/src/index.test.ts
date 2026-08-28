import { describe, expect, it } from "vitest";
import {
  formatResetAbsolute,
  formatResetCopy,
  formatResetRelative,
} from "./index.ts";

describe("formatResetRelative", () => {
  it("formats fifty-one minutes", () => {
    const now = new Date("2026-08-27T11:22:00");
    const resetsAt = new Date("2026-08-27T12:13:00");
    expect(formatResetRelative(resetsAt, now)).toBe("Resets in 51 min");
  });

  it("formats two hours ten minutes", () => {
    const now = new Date("2026-08-27T11:22:00");
    const resetsAt = new Date("2026-08-27T13:32:00");
    expect(formatResetRelative(resetsAt, now)).toBe("Resets in 2h 10 min");
  });
});

describe("formatResetAbsolute", () => {
  it("formats Thursday midnight", () => {
    const resetsAt = new Date("2026-09-03T00:00:00");
    expect(formatResetAbsolute(resetsAt, "en-US")).toBe("Resets Thu 12:00 AM");
  });
});

describe("formatResetCopy", () => {
  it("uses relative style under 24 hours", () => {
    const now = new Date("2026-08-27T11:22:00");
    expect(
      formatResetCopy("2026-08-27T12:13:00.000Z", "relative", now, "en-US"),
    ).toMatch(/^Resets in /);
  });
});
