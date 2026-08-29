import { describe, expect, it } from "vitest";
import { nearestEdge, snapAfterDrag } from "./snap.ts";

const display = { x: 0, y: 0, width: 1440, height: 900 };
const win = { x: 0, y: 200, width: 400, height: 320 };

describe("snapAfterDrag", () => {
  it("snaps to the right edge when close", () => {
    const result = snapAfterDrag({ ...win, x: 1020 }, display, 56);
    expect(result.snapped).toBe(true);
    expect(result.preset).toBe("right-edge");
    expect(result.x).toBe(1040);
  });

  it("keeps a free position in the middle", () => {
    const result = snapAfterDrag({ ...win, x: 520, y: 240 }, display, 56);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(520);
    expect(result.y).toBe(240);
  });

  it("clamps off-screen drops", () => {
    const result = snapAfterDrag({ ...win, x: -80, y: -40 }, display, 56);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.preset).toBe("left-edge");
  });
});

describe("nearestEdge", () => {
  it("picks the closest edge for card growth", () => {
    expect(nearestEdge({ ...win, x: 20, y: 300 }, display)).toBe("left");
    expect(nearestEdge({ ...win, x: 1000, y: 300 }, display)).toBe("right");
  });
});
