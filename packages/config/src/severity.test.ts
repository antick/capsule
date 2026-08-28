import { describe, expect, it } from "vitest";
import { severityForPercent } from "./severity.ts";

describe("severityForPercent", () => {
  it("maps 21 to low", () => {
    expect(severityForPercent(21)).toBe("low");
  });

  it("maps 52 to mid", () => {
    expect(severityForPercent(52)).toBe("mid");
  });

  it("maps 73 to high", () => {
    expect(severityForPercent(73)).toBe("high");
  });

  it("maps 95 to critical", () => {
    expect(severityForPercent(95)).toBe("critical");
  });

  it("maps band edges inclusively", () => {
    expect(severityForPercent(39)).toBe("low");
    expect(severityForPercent(40)).toBe("mid");
    expect(severityForPercent(69)).toBe("mid");
    expect(severityForPercent(70)).toBe("high");
    expect(severityForPercent(89)).toBe("high");
    expect(severityForPercent(90)).toBe("critical");
  });
});
