import { describe, expect, it } from "vitest";
import { nearestEdgeForPoint, slideAlongEdge } from "./snap.ts";

const display = { x: 0, y: 0, width: 1440, height: 900 };

describe("nearestEdgeForPoint", () => {
  it("picks the edge the cursor sits nearest", () => {
    expect(nearestEdgeForPoint({ x: 20, y: 450 }, display)).toBe("left");
    expect(nearestEdgeForPoint({ x: 1420, y: 450 }, display)).toBe("right");
    expect(nearestEdgeForPoint({ x: 720, y: 12 }, display)).toBe("top");
    expect(nearestEdgeForPoint({ x: 720, y: 880 }, display)).toBe("bottom");
  });

  it("measures distance proportionally, so a wide screen still favours the sides", () => {
    // 300px from the left but only 200px from the top: the left edge is
    // nearer as a fraction of the display, which is what the wedges follow.
    expect(nearestEdgeForPoint({ x: 300, y: 200 }, display)).toBe("left");
  });

  it("splits the screen on the diagonals", () => {
    // Same x, either side of the corner diagonal.
    expect(nearestEdgeForPoint({ x: 100, y: 40 }, display)).toBe("top");
    expect(nearestEdgeForPoint({ x: 100, y: 120 }, display)).toBe("left");
  });
});

describe("slideAlongEdge", () => {
  it("pins x for a right-edge dock and follows the cursor on y", () => {
    const result = slideAlongEdge({
      slide: { axis: "y", min: 0, max: 580 },
      anchorX: 1040,
      anchorY: 200,
      cursor: { x: 1200, y: 500 },
      grabOffset: 40,
    });
    expect(result.x).toBe(1040);
    expect(result.y).toBe(460);
  });

  it("pins y for a bottom dock and follows the cursor on x", () => {
    const result = slideAlongEdge({
      slide: { axis: "x", min: 0, max: 1040 },
      anchorX: 200,
      anchorY: 820,
      cursor: { x: 700, y: 890 },
      grabOffset: 100,
    });
    expect(result.x).toBe(600);
    expect(result.y).toBe(820);
  });

  it("clamps to the slide range so the dock cannot leave the screen", () => {
    const slide = { axis: "x", min: 0, max: 1040 } as const;
    expect(
      slideAlongEdge({
        slide,
        anchorX: 0,
        anchorY: 820,
        cursor: { x: -200, y: 890 },
        grabOffset: 100,
      }).x,
    ).toBe(0);
    expect(
      slideAlongEdge({
        slide,
        anchorX: 0,
        anchorY: 820,
        cursor: { x: 5000, y: 890 },
        grabOffset: 100,
      }).x,
    ).toBe(1040);
  });
});
