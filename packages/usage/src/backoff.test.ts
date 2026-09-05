import { BACKOFF } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { backoffMs, retryAfterMs } from "./backoff.ts";

describe("backoffMs", () => {
  it("starts at the floor and doubles per refusal, up to the ceiling", () => {
    expect(backoffMs(1, null)).toBe(BACKOFF.floorMs);
    expect(backoffMs(2, null)).toBe(BACKOFF.floorMs * 2);
    expect(backoffMs(3, null)).toBe(BACKOFF.floorMs * 4);
    expect(backoffMs(9, null)).toBe(BACKOFF.ceilingMs);
  });

  it("treats the server's hint as a floor-raiser only", () => {
    // `Retry-After: 0` must not mean "retry now" — that is what keeps you
    // rate limited.
    expect(backoffMs(1, 0)).toBe(BACKOFF.floorMs);
    expect(backoffMs(1, 3 * 60_000)).toBe(3 * 60_000);
    expect(backoffMs(1, 60 * 60_000)).toBe(BACKOFF.ceilingMs);
  });
});

describe("retryAfterMs", () => {
  const now = new Date("2026-08-27T11:22:00.000Z");

  it("reads seconds and HTTP dates, and shrugs at anything else", () => {
    expect(retryAfterMs("30", now)).toBe(30_000);
    expect(retryAfterMs("Thu, 27 Aug 2026 11:23:00 GMT", now)).toBe(60_000);
    expect(retryAfterMs("soon", now)).toBeNull();
    expect(retryAfterMs(null, now)).toBeNull();
  });
});
