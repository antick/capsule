import { describe, expect, it } from "vitest";
import { notchFromProbe } from "./hardware-notch.ts";

describe("notchFromProbe", () => {
  const macbook = { w: 1512, h: 982, top: 37, left: 656, right: 656 };
  const external = { w: 3840, h: 1620, top: 0, left: 0, right: 0 };

  it("measures the notch from the strips either side of it", () => {
    expect(
      notchFromProbe([external, macbook], {
        bounds: { width: 1512, height: 982 },
      }),
    ).toEqual({ width: 200, height: 37 });
  });

  it("finds none on a display without auxiliary areas, or of another size", () => {
    expect(
      notchFromProbe([external, macbook], {
        bounds: { width: 3840, height: 1620 },
      }),
    ).toBeNull();
    expect(
      notchFromProbe([macbook], { bounds: { width: 2560, height: 1440 } }),
    ).toBeNull();
  });
});
