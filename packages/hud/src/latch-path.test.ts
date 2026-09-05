import {
  cardHeightForBuckets,
  hudMetrics,
  joinOffsetForIndex,
  railLengthForCount,
} from "@capsule/config";
import { describe, expect, it } from "vitest";
import { blobLayout, type CardGrowth, railPath } from "./blob-path.ts";
import {
  latchHotZone,
  latchRect,
  railMorph,
  restingRail,
  stowShift,
} from "./latch-path.ts";

const m = hudMetrics(1);
const growths: CardGrowth[] = ["left", "right", "up", "down"];

function layoutFor(cardGrowth: CardGrowth) {
  return blobLayout(m, {
    cardGrowth,
    railLength: railLengthForCount(m, 3),
    joinOffset: joinOffsetForIndex(m, 1),
    cardHeight: cardHeightForBuckets(m, 2),
  });
}

/** The end point of every segment; arc radii and flags are skipped over. */
function coords(path: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const segment of path.match(/[MLA][^MLAZ]*/g) ?? []) {
    const numbers = segment
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const x = numbers[numbers.length - 2];
    const y = numbers[numbers.length - 1];
    if (x !== undefined && y !== undefined) {
      out.push({ x, y });
    }
  }
  return out;
}

describe("restingRail", () => {
  it("is a sliver on the rail's outer face, centred along it", () => {
    const layout = layoutFor("left");
    const rail = layout.canonical.rail;
    const rest = restingRail(m, layout);
    expect(rest.width).toBe(m.latchThickness);
    expect(rest.x + rest.width).toBe(rail.x + rail.width);
    expect(rest.height).toBe(m.latchLength);
    expect(rest.y + rest.height / 2).toBeCloseTo(rail.y + rail.height / 2);
  });

  it("lands inside the rail on every edge once oriented", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth);
      const latch = latchRect(m, growth, layout);
      const rail = layout.rail;
      expect(latch.x).toBeGreaterThanOrEqual(rail.x);
      expect(latch.y).toBeGreaterThanOrEqual(rail.y);
      expect(latch.x + latch.width).toBeLessThanOrEqual(rail.x + rail.width);
      expect(latch.y + latch.height).toBeLessThanOrEqual(rail.y + rail.height);
      const zone = latchHotZone(m, growth, layout);
      expect(Math.max(zone.width, zone.height)).toBeGreaterThan(
        m.latchThickness,
      );
    }
  });
});

describe("railMorph", () => {
  it("is the full rail when open", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth);
      expect(railMorph(m, growth, layout, 1).path).toBe(
        railPath(m, growth, layout),
      );
    }
  });

  it("is the latch when folded, on every edge", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth);
      const morph = railMorph(m, growth, layout, 0);
      const latch = latchRect(m, growth, layout);
      expect(morph.path.endsWith("Z")).toBe(true);
      expect(morph.path).not.toContain("NaN");
      // Every point of the outline lies on or inside the latch's box, give
      // or take the flare that blends it into the edge.
      const slack = m.latchThickness;
      for (const p of coords(morph.path)) {
        expect(p.x).toBeGreaterThanOrEqual(latch.x - slack);
        expect(p.x).toBeLessThanOrEqual(latch.x + latch.width + slack);
        expect(p.y).toBeGreaterThanOrEqual(latch.y - slack);
        expect(p.y).toBeLessThanOrEqual(latch.y + latch.height + slack);
      }
    }
  });

  it("grows through the sizes in between with the same centre line", () => {
    const layout = layoutFor("left");
    const half = railMorph(m, "left", layout, 0.5);
    const full = layout.canonical.rail;
    const rest = restingRail(m, layout);
    expect(half.rail.width).toBeCloseTo((full.width + rest.width) / 2);
    expect(half.rail.x + half.rail.width).toBeCloseTo(full.x + full.width);
    expect(half.rail.y + half.rail.height / 2).toBeCloseTo(
      full.y + full.height / 2,
    );
    expect(half.path).not.toBe(railMorph(m, "left", layout, 0).path);
    expect(half.path).not.toBe(railMorph(m, "left", layout, 1).path);
  });

  it("clamps the fold to the two ends", () => {
    const layout = layoutFor("left");
    expect(railMorph(m, "left", layout, 1.2).path).toBe(
      railMorph(m, "left", layout, 1).path,
    );
    expect(railMorph(m, "left", layout, -0.2).path).toBe(
      railMorph(m, "left", layout, 0).path,
    );
  });

  it("writes the clip in the rail box's own coordinates", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth);
      const morph = railMorph(m, growth, layout, 1);
      const shape = coords(morph.path);
      const clip = coords(morph.clip);
      expect(clip.length).toBe(shape.length);
      for (const [index, p] of shape.entries()) {
        expect(clip[index]?.x).toBeCloseTo(p.x - layout.rail.x, 1);
        expect(clip[index]?.y).toBeCloseTo(p.y - layout.rail.y, 1);
      }
    }
  });
});

describe("stowShift", () => {
  it("points at the screen edge on every placement", () => {
    expect(stowShift(m, "left")).toEqual({ x: m.stowShift, y: 0 });
    expect(stowShift(m, "right")).toEqual({ x: -m.stowShift, y: 0 });
    expect(stowShift(m, "up")).toEqual({ x: 0, y: m.stowShift });
    expect(stowShift(m, "down")).toEqual({ x: 0, y: -m.stowShift });
  });
});

describe("joined with the display's notch", () => {
  const notch = { width: 200, height: 32 };

  it("folds away to exactly the hardware notch, centred on the rail", () => {
    const layout = blobLayout(m, {
      cardGrowth: "down",
      railLength: 300,
      joinOffset: 60,
      cardHeight: cardHeightForBuckets(m, 2),
      railDepth: m.railWidth + notch.height,
      flare: m.notchBezelFillet,
    });
    const rest = restingRail(m, layout, notch);
    const rail = layout.canonical.rail;
    expect(rest.width).toBe(notch.height);
    expect(rest.height).toBe(notch.width);
    expect(rest.x + rest.width).toBe(rail.x + rail.width);
    expect(rest.y + rest.height / 2).toBeCloseTo(rail.y + rail.height / 2);
    // Oriented for the top edge: as wide as the notch, hanging from the top.
    const latch = latchRect(m, "down", layout, notch);
    expect(latch.width).toBe(notch.width);
    expect(latch.height).toBe(notch.height);
    expect(latch.y).toBe(layout.rail.y);
    // And the band that wakes it reaches below the hole.
    const zone = latchHotZone(m, "down", layout, notch);
    expect(zone.height).toBe(notch.height + m.latchReach);
    const folded = railMorph(m, "down", layout, 0, {
      notch: true,
      flare: m.notchBezelFillet,
      resting: rest,
    });
    for (const p of coords(folded.path)) {
      expect(p.x).toBeGreaterThanOrEqual(latch.x - m.notchBezelFillet);
      expect(p.x).toBeLessThanOrEqual(
        latch.x + latch.width + m.notchBezelFillet,
      );
      expect(p.y).toBeLessThanOrEqual(latch.y + latch.height);
    }
  });
});
