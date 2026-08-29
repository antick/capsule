import { describe, expect, it } from "vitest";
import {
  bandClearance,
  cornerCardGrowth,
  cornerCardRect,
  cornerForRail,
  cornerGeometry,
  cornerMeterCentre,
  cornerWindowSize,
  railStartForCorner,
} from "./corner.ts";
import { DOCK_STYLES } from "./dock-style.ts";
import { cardHeightForBuckets, hudMetrics } from "./metrics.ts";
import type { SlideTrack } from "./placement.ts";

const m = hudMetrics(1);
const cardHeight = cardHeightForBuckets(m, 3);
const QUARTER = Math.PI / 2;

function geometry(meterCount: number) {
  return cornerGeometry(m, {
    meterCount,
    cardWidth: m.cardWidth,
    cardHeight,
    cap: m.railWidth / 2,
  });
}

describe("cornerGeometry", () => {
  it("spreads every meter inside the quadrant it has to bridge", () => {
    for (const count of [1, 2, 3, 4]) {
      const g = geometry(count);
      expect(g.angles).toHaveLength(count);
      for (const angle of g.angles) {
        // A meter that ran past either end would hang off the screen edge the
        // arc is supposed to meet.
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThanOrEqual(QUARTER);
      }
      expect([...g.angles].sort((a, b) => a - b)).toEqual(g.angles);
    }
  });

  it("keeps the meters the same distance apart as a straight rail does", () => {
    const g = geometry(3);
    const gaps = g.angles
      .slice(1)
      .map((angle, index) => (angle - (g.angles[index] ?? 0)) * g.radius);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(m.meterSize + m.itemGap, 5);
    }
  });

  it("never curls so tight that the band reads as a blob", () => {
    // One meter needs almost no arc, so only the floor keeps it a band.
    expect(geometry(1).radius).toBeGreaterThan(m.railWidth);
  });

  it("balances the arc on the diagonal", () => {
    const g = geometry(3);
    const first = g.angles[0] ?? 0;
    const last = g.angles[g.angles.length - 1] ?? 0;
    expect(first + last).toBeCloseTo(QUARTER, 5);
  });

  it("sizes the frame to hold every card it can be asked to show", () => {
    for (const count of [1, 2, 3, 4]) {
      const g = geometry(count);
      for (let index = 0; index < count; index += 1) {
        const card = cornerCardRect(g, m, index, m.cardWidth, cardHeight);
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.y).toBeGreaterThanOrEqual(0);
        expect(card.x + card.width).toBeLessThanOrEqual(g.width + 0.001);
        expect(card.y + card.height).toBeLessThanOrEqual(g.height + 0.001);
      }
    }
  });
});

describe("cornerCardRect", () => {
  const g = geometry(3);

  it("turns the card to face whichever edge its meter is nearest", () => {
    // The first meter sits near the arc's start, so its card leaves along the
    // other axis; the last one is the mirror of it.
    expect(cornerCardGrowth(g, 0)).toBe("y");
    expect(cornerCardGrowth(g, 2)).toBe("x");
  });

  it("leaves a tail's worth of room between the card and its meter", () => {
    for (let index = 0; index < 3; index += 1) {
      const centre = cornerMeterCentre(g, index);
      const card = cornerCardRect(g, m, index, m.cardWidth, cardHeight);
      const gap =
        cornerCardGrowth(g, index) === "y"
          ? card.y - centre.y
          : card.x - centre.x;
      expect(gap).toBeCloseTo(m.railWidth / 2 + m.tailLength + m.joinGap, 5);
    }
  });

  it("keeps the card square on to the meter it belongs to", () => {
    const centre = cornerMeterCentre(g, 1);
    const card = cornerCardRect(g, m, 1, m.cardWidth, cardHeight);
    const growth = cornerCardGrowth(g, 1);
    // Centred across the growth axis unless the band or a frame edge got in
    // the way.
    const across =
      growth === "y" ? card.x + card.width / 2 : card.y + card.height / 2;
    const target = growth === "y" ? centre.x : centre.y;
    const span = growth === "y" ? card.width : card.height;
    const frame = growth === "y" ? g.width : g.height;
    const min = bandClearance(g.outer, growth === "y" ? card.y : card.x);
    const clamped = Math.min(
      Math.max(target - span / 2, min),
      Math.max(min, frame - span),
    );
    expect(across).toBeCloseTo(clamped + span / 2, 5);
  });

  it("never lays the card over the ring or the other meters", () => {
    for (const count of [2, 3, 4]) {
      const arc = geometry(count);
      for (let index = 0; index < count; index += 1) {
        const card = cornerCardRect(arc, m, index, m.cardWidth, cardHeight);
        // The whole card sits outside the band's outer edge, so the nearest
        // point of it to the corner is still further out than the ring.
        const near = Math.hypot(card.x, card.y);
        expect(near).toBeGreaterThanOrEqual(arc.outer - 0.001);
        for (let other = 0; other < count; other += 1) {
          const centre = cornerMeterCentre(arc, other);
          const inside =
            centre.x > card.x &&
            centre.x < card.x + card.width &&
            centre.y > card.y &&
            centre.y < card.y + card.height;
          expect(inside).toBe(false);
        }
      }
    }
  });
});

describe("cornerWindowSize", () => {
  it("adds a shadow gutter on the two sides facing the screen", () => {
    const g = geometry(3);
    const window = cornerWindowSize(m, {
      meterCount: 3,
      cardHeight,
      style: DOCK_STYLES.rail,
    });
    expect(window.width).toBe(Math.ceil(g.width + m.shadowPadding));
    expect(window.height).toBe(Math.ceil(g.height + m.shadowPadding));
  });

  it("makes room for a style that floats clear of the edge", () => {
    const flush = cornerWindowSize(m, {
      meterCount: 3,
      cardHeight,
      style: DOCK_STYLES.rail,
    });
    const floating = cornerWindowSize(m, {
      meterCount: 3,
      cardHeight,
      style: DOCK_STYLES.capsule,
    });
    expect(floating.width).toBeGreaterThan(flush.width);
    expect(floating.height).toBeGreaterThan(flush.height);
  });
});

function track(axis: "x" | "y", min: number, max: number): SlideTrack {
  return {
    axis,
    min,
    max,
    railLength: 200,
    gutter: 18,
    slack: 40,
    windowMin: min - 18,
    windowMax: max - 18,
  };
}

describe("cornerForRail", () => {
  const slide = track("y", 0, 1000);

  it("curls only once the rail has run out of edge to travel", () => {
    expect(cornerForRail("right", slide, 500, 28)).toBeNull();
    expect(cornerForRail("right", slide, 40, 28)).toBeNull();
    expect(cornerForRail("right", slide, 10, 28)).toBe("top-right");
    expect(cornerForRail("right", slide, 990, 28)).toBe("bottom-right");
  });

  it("names the corner from the edge and the end it reached", () => {
    expect(cornerForRail("left", slide, 0, 28)).toBe("top-left");
    expect(cornerForRail("left", slide, 1000, 28)).toBe("bottom-left");
    const across = track("x", 0, 1000);
    expect(cornerForRail("top", across, 0, 28)).toBe("top-left");
    expect(cornerForRail("top", across, 1000, 28)).toBe("top-right");
    expect(cornerForRail("bottom", across, 0, 28)).toBe("bottom-left");
    expect(cornerForRail("bottom", across, 1000, 28)).toBe("bottom-right");
  });

  it("puts a curled dock back where it curled from", () => {
    const down = track("y", 0, 1000);
    const across = track("x", 0, 1000);
    expect(railStartForCorner(down, "top-right")).toBe(0);
    expect(railStartForCorner(down, "bottom-right")).toBe(1000);
    expect(railStartForCorner(across, "top-left")).toBe(0);
    expect(railStartForCorner(across, "bottom-right")).toBe(1000);
  });

  it("round-trips every corner it can name", () => {
    for (const [edge, slide] of [
      ["right", track("y", 0, 1000)],
      ["left", track("y", 0, 1000)],
      ["top", track("x", 0, 1000)],
      ["bottom", track("x", 0, 1000)],
    ] as const) {
      for (const railStart of [slide.min, slide.max]) {
        const corner = cornerForRail(edge, slide, railStart, 28);
        expect(corner).not.toBeNull();
        if (corner) {
          expect(railStartForCorner(slide, corner)).toBe(railStart);
        }
      }
    }
  });
});
