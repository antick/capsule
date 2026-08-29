import {
  CORNERS,
  cardHeightForBuckets,
  DOCK_STYLES,
  hudMetrics,
} from "@capsule/config";
import { describe, expect, it } from "vitest";
import { cornerLayout } from "./corner-path.ts";

const m = hudMetrics(1);
const cardHeight = cardHeightForBuckets(m, 2);

function layoutFor(
  corner: (typeof CORNERS)[number],
  activeIndex: number,
  meterCount = 3,
) {
  return cornerLayout(m, {
    corner,
    meterCount,
    cardHeight,
    cardReserve: cardHeightForBuckets(m, 3),
    activeIndex,
    style: DOCK_STYLES.rail,
  });
}

/**
 * Signed area of a subpath, sampling only its straight runs and arc endpoints.
 * The sign is all we need: two subpaths that wind opposite ways punch a hole
 * in each other instead of merging.
 */
function windingOf(subpath: string): number {
  const points: [number, number][] = [];
  const tokens = subpath.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "M" || token === "L") {
      points.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      i += 2;
    } else if (token === "A") {
      points.push([Number(tokens[i + 6]), Number(tokens[i + 7])]);
      i += 7;
    }
  }
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i] ?? [0, 0];
    const [x2, y2] = points[(i + 1) % points.length] ?? [0, 0];
    total += x1 * y2 - x2 * y1;
  }
  return total;
}

function subpaths(path: string): string[] {
  return path
    .split(/(?=M )/)
    .map((part) => part.trim())
    .filter(Boolean);
}

describe("cornerLayout", () => {
  it("draws a clean arc and bubble for every corner and meter", () => {
    for (const corner of CORNERS) {
      for (let index = 0; index < 3; index += 1) {
        const layout = layoutFor(corner, index);
        for (const path of [layout.arc, layout.bubble]) {
          expect(path).not.toContain("NaN");
          expect(path.trim().endsWith("Z")).toBe(true);
        }
      }
    }
  });

  it("winds the card and its tail the same way", () => {
    for (const corner of CORNERS) {
      for (let index = 0; index < 3; index += 1) {
        const parts = subpaths(layoutFor(corner, index).bubble);
        expect(parts).toHaveLength(2);
        const [card, tail] = parts.map(windingOf);
        // Opposite signs would subtract the tail and leave a triangle of
        // desktop punched through the join.
        expect(Math.sign(card ?? 0)).toBe(Math.sign(tail ?? 0));
      }
    }
  });

  it("lands the tail on the meter, never short of it", () => {
    for (const corner of CORNERS) {
      for (let index = 0; index < 3; index += 1) {
        const layout = layoutFor(corner, index);
        const meter = layout.meters[index];
        expect(layout.tip.x).toBeCloseTo(meter?.x ?? -1, 5);
        expect(layout.tip.y).toBeCloseTo(meter?.y ?? -1, 5);
      }
    }
  });

  it("keeps the card and every meter inside the frame it is drawn in", () => {
    for (const corner of CORNERS) {
      for (let index = 0; index < 3; index += 1) {
        const layout = layoutFor(corner, index);
        expect(layout.card.x).toBeGreaterThanOrEqual(0);
        expect(layout.card.y).toBeGreaterThanOrEqual(0);
        expect(layout.card.x + layout.card.width).toBeLessThanOrEqual(
          layout.width + 0.001,
        );
        expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(
          layout.height + 0.001,
        );
        for (const meter of layout.meters) {
          expect(meter.x).toBeGreaterThanOrEqual(0);
          expect(meter.y).toBeGreaterThanOrEqual(0);
          expect(meter.x).toBeLessThanOrEqual(layout.width);
          expect(meter.y).toBeLessThanOrEqual(layout.height);
        }
      }
    }
  });

  it("anchors the band on the corner it was asked for", () => {
    // The arc has to touch both screen edges, which in the frame means the
    // two sides that carry no shadow gutter.
    const bottomRight = layoutFor("bottom-right", 0);
    expect(bottomRight.padding.right).toBe(0);
    expect(bottomRight.padding.bottom).toBe(0);
    expect(bottomRight.padding.top).toBe(m.shadowPadding);
    expect(bottomRight.padding.left).toBe(m.shadowPadding);

    const topLeft = layoutFor("top-left", 0);
    expect(topLeft.padding.top).toBe(0);
    expect(topLeft.padding.left).toBe(0);
    expect(topLeft.padding.right).toBe(m.shadowPadding);
    expect(topLeft.padding.bottom).toBe(m.shadowPadding);
  });

  it("gives every meter a live square to be hovered by", () => {
    const layout = layoutFor("bottom-right", 1);
    expect(layout.hits).toHaveLength(layout.meters.length);
    layout.hits.forEach((hit, index) => {
      const meter = layout.meters[index];
      expect(hit.x + hit.width / 2).toBeCloseTo(meter?.x ?? -1, 5);
      expect(hit.y + hit.height / 2).toBeCloseTo(meter?.y ?? -1, 5);
    });
  });
});
