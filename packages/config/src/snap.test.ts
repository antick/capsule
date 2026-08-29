import { describe, expect, it } from "vitest";
import { dockAlongEdge, type SlideTrack } from "./placement.ts";
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

/**
 * A 200px rail in a frame stretched to 280px by the card, inside a window that
 * adds an 18px shadow gutter at each end: 316px of window for 200px of dock.
 */
function track(axis: "x" | "y", span: number): SlideTrack {
  const rail = 200;
  const slack = 80;
  const gutter = 18;
  return {
    axis,
    min: 0,
    max: span - rail,
    railLength: rail,
    gutter,
    slack,
    windowMin: -gutter,
    windowMax: span - (rail + slack + gutter * 2) + gutter,
  };
}

describe("dockAlongEdge", () => {
  it("centres the rail in its frame while there is room either side", () => {
    const placed = dockAlongEdge(track("x", 1440), 600);
    expect(placed.window).toBe(542);
    // 600 - 542 - 18: half the slack, so the frame extends evenly both ways.
    expect(placed.railBias).toBe(40);
  });

  it("stops the window at the edge and slides the rail on to the corner", () => {
    const slide = track("x", 1440);
    const placed = dockAlongEdge(slide, slide.max);
    // The window can only overhang by its transparent gutter, which keeps the
    // card on screen, so the rail covers the rest of the distance itself.
    expect(placed.window).toBe(1142);
    expect(placed.railBias).toBe(slide.slack);
    // Which puts the far end of the rail exactly on the screen edge.
    expect(
      placed.window + slide.gutter + placed.railBias + slide.railLength,
    ).toBe(1440);
  });

  it("puts the rail flush against the near edge too", () => {
    const placed = dockAlongEdge(track("y", 900), 0);
    expect(placed.window).toBe(-18);
    expect(placed.railBias).toBe(0);
  });

  it("never asks for a rail position outside the track", () => {
    const slide = track("x", 1440);
    expect(dockAlongEdge(slide, -900)).toEqual(dockAlongEdge(slide, slide.min));
    expect(dockAlongEdge(slide, 9000)).toEqual(dockAlongEdge(slide, slide.max));
  });
});

describe("slideAlongEdge", () => {
  it("pins x for a right-edge dock and follows the cursor on y", () => {
    const result = slideAlongEdge({
      slide: track("y", 900),
      anchorX: 1040,
      anchorY: 200,
      cursor: { x: 1200, y: 500 },
      grabOffset: 40,
    });
    expect(result.x).toBe(1040);
    expect(result.railStart).toBe(460);
    expect(result.y).toBe(402);
  });

  it("pins y for a bottom dock and follows the cursor on x", () => {
    const result = slideAlongEdge({
      slide: track("x", 1440),
      anchorX: 200,
      anchorY: 820,
      cursor: { x: 700, y: 890 },
      grabOffset: 100,
    });
    expect(result.railStart).toBe(600);
    expect(result.x).toBe(542);
    expect(result.y).toBe(820);
  });

  it("keeps the rail under the cursor after the window has stopped", () => {
    const slide = track("x", 1440);
    const result = slideAlongEdge({
      slide,
      anchorX: 0,
      anchorY: 820,
      cursor: { x: 5000, y: 890 },
      grabOffset: 100,
    });
    expect(result.railStart).toBe(slide.max);
    expect(result.x).toBe(slide.windowMax);
    expect(result.railBias).toBe(slide.slack);
  });
});
