import { describe, expect, it } from "vitest";
import { dayKey, formatCompactCount, startOfDay } from "./tokens.ts";

describe("formatCompactCount", () => {
  it("keeps a steady width as the number climbs", () => {
    expect(formatCompactCount(12)).toBe("12");
    expect(formatCompactCount(840)).toBe("840");
    expect(formatCompactCount(1_234)).toBe("1.23k");
    expect(formatCompactCount(84_000)).toBe("84k");
    expect(formatCompactCount(1_200_000)).toBe("1.2m");
    expect(formatCompactCount(123_456_789)).toBe("123m");
    expect(formatCompactCount(2_500_000_000)).toBe("2.5b");
    expect(formatCompactCount(0)).toBe("0");
  });
});

describe("day keys", () => {
  it("names days in local time and walks back whole days", () => {
    const now = new Date(2026, 8, 6, 23, 59);
    expect(dayKey(now)).toBe("2026-09-06");
    expect(dayKey(startOfDay(now, 1))).toBe("2026-09-05");
    expect(startOfDay(now).getHours()).toBe(0);
    expect(dayKey(startOfDay(now, 29))).toBe("2026-08-08");
  });
});
