import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatElapsed,
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
  const now = new Date("2026-08-27T11:22:00");

  it("formats Thursday midnight", () => {
    const resetsAt = new Date("2026-09-03T00:00:00");
    expect(formatResetAbsolute(resetsAt, "en-US", now)).toBe(
      "Resets Thu 12:00 AM",
    );
  });

  it("says today and tomorrow when that is what they are", () => {
    expect(
      formatResetAbsolute(new Date("2026-08-27T15:00:00"), "en-US", now),
    ).toBe("Resets today 3:00 PM");
    expect(
      formatResetAbsolute(new Date("2026-08-28T00:00:00"), "en-US", now),
    ).toBe("Resets tomorrow 12:00 AM");
    expect(
      formatResetAbsolute(new Date("2026-08-29T09:30:00"), "en-US", now),
    ).toBe("Resets Sat 9:30 AM");
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

describe("formatElapsed", () => {
  const now = new Date("2026-08-27T11:22:00");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("rounds anything under forty-five seconds to just now", () => {
    expect(formatElapsed(ago(0), now)).toBe("just now");
    expect(formatElapsed(ago(44_000), now)).toBe("just now");
  });

  it("counts minutes, then hours and minutes", () => {
    expect(formatElapsed(ago(45_000), now)).toBe("1 min");
    expect(formatElapsed(ago(3 * 60_000), now)).toBe("3 min");
    expect(formatElapsed(ago(2 * 60 * 60_000), now)).toBe("2 hr");
    expect(formatElapsed(ago(125 * 60_000), now)).toBe("2 hr 5 min");
  });

  it("phrases the same span as a point in the past", () => {
    expect(formatAgo(ago(0), now)).toBe("just now");
    expect(formatAgo(ago(12 * 60_000), now)).toBe("12 min ago");
  });
});
