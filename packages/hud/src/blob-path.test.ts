import {
  cardHeightForBuckets,
  hudMetrics,
  joinOffsetForIndex,
  railLengthForCount,
} from "@capsule/config";
import { describe, expect, it } from "vitest";
import {
  blobLayout,
  bubblePath,
  type CardGrowth,
  framePadding,
  railPath,
} from "./blob-path.ts";

const m = hudMetrics(1);
const railLength = railLengthForCount(m, 3);
const cardHeight = cardHeightForBuckets(m, 2);

function layoutFor(cardGrowth: CardGrowth, index: number) {
  return blobLayout(m, {
    cardGrowth,
    railLength,
    joinOffset: joinOffsetForIndex(m, index),
    cardHeight,
  });
}

describe("blobLayout", () => {
  it("keeps a right-edge rail flush with the canvas edge", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.x + layout.rail.width).toBe(layout.width);
    expect(layout.card.x).toBe(0);
    expect(layout.rail.width).toBe(m.railWidth);
  });

  it("leaves a visible gap between the tail tip and the rail", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.x - layout.tip.x).toBe(m.joinGap);
    expect(layout.tip.x - (layout.card.x + layout.card.width)).toBe(
      m.tailLength,
    );
  });

  it("reserves room for the flares at both ends of the rail", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.y).toBe(m.edgeFlare);
    expect(layout.height).toBe(railLength + m.edgeFlare * 2);
  });

  it("centres the card on the meter its tail points at", () => {
    for (const index of [0, 1, 2]) {
      const layout = layoutFor("left", index);
      const centre = layout.card.y + layout.card.height / 2;
      expect(Math.abs(centre - layout.join.y)).toBeLessThanOrEqual(1);
    }
  });

  it("slides the card down as later meters open", () => {
    expect(layoutFor("left", 1).card.y).toBeGreaterThan(
      layoutFor("left", 0).card.y,
    );
  });

  it("lays a horizontal dock out along the other axis", () => {
    const horizontal = layoutFor("up", 0);
    expect(horizontal.rail.y + horizontal.rail.height).toBe(horizontal.height);
    expect(horizontal.rail.width).toBe(railLength);
    expect(horizontal.rail.height).toBe(m.railWidth);
  });

  it("keeps the card landscape on every edge", () => {
    // A card rotated with the frame is unreadable; only the tail should turn.
    for (const growth of ["left", "right", "up", "down"] as CardGrowth[]) {
      const layout = layoutFor(growth, 0);
      expect(layout.card.width).toBe(m.cardWidth);
      expect(layout.card.height).toBe(cardHeight);
    }
  });

  it("keeps the card inside the frame on horizontal edges", () => {
    for (const growth of ["up", "down"] as CardGrowth[]) {
      const layout = layoutFor(growth, 0);
      expect(layout.card.x).toBeGreaterThanOrEqual(0);
      expect(layout.card.x + layout.card.width).toBeLessThanOrEqual(
        layout.width,
      );
    }
  });

  it("mirrors the rail to the near side for left-edge docks", () => {
    const layout = layoutFor("right", 0);
    expect(layout.rail.x).toBe(0);
    expect(layout.card.x + layout.card.width).toBe(layout.width);
    expect(layout.tip.x - layout.rail.width).toBe(m.joinGap);
  });

  it("scales the whole silhouette with the user's size preference", () => {
    const small = hudMetrics(0.6);
    const layout = blobLayout(small, {
      cardGrowth: "left",
      railLength: railLengthForCount(small, 3),
      joinOffset: joinOffsetForIndex(small, 0),
      cardHeight: cardHeightForBuckets(small, 2),
    });
    const full = layoutFor("left", 0);
    expect(layout.width).toBeLessThan(full.width);
    expect(layout.height).toBeLessThan(full.height);
    expect(layout.rail.width).toBe(small.railWidth);
  });
});

describe("silhouettes", () => {
  const growths: CardGrowth[] = ["left", "right", "up", "down"];

  it("closes both shapes in every orientation", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth, 1);
      expect(railPath(m, growth, layout).endsWith("Z")).toBe(true);
      expect(bubblePath(m, growth, layout).endsWith("Z")).toBe(true);
    }
  });

  it("emits no NaN coordinates", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth, 2);
      expect(railPath(m, growth, layout)).not.toContain("NaN");
      expect(bubblePath(m, growth, layout)).not.toContain("NaN");
    }
  });

  it("runs the rail's flush side straight along the canvas edge", () => {
    const layout = layoutFor("left", 0);
    const right = layout.width;
    const path = railPath(m, "left", layout);
    expect(path.startsWith(`M ${right} 0`)).toBe(true);
    expect(path).toContain(`${right} ${layout.height}`);
  });

  it("keeps the notch corners tighter than the rail's", () => {
    const layout = layoutFor("down", 0);
    expect(railPath(m, "down", layout, true)).not.toBe(
      railPath(m, "down", layout, false),
    );
    expect(railPath(m, "down", layout, true)).toContain(
      `A ${m.notchRadius} ${m.notchRadius}`,
    );
  });

  it("moves the tail when the open meter changes", () => {
    expect(bubblePath(m, "left", layoutFor("left", 0))).not.toBe(
      bubblePath(m, "left", layoutFor("left", 2)),
    );
  });
});

describe("framePadding", () => {
  it("drops the gutter on the flush side", () => {
    expect(framePadding(m, "left").right).toBe(0);
    expect(framePadding(m, "right").left).toBe(0);
    expect(framePadding(m, "up").bottom).toBe(0);
    expect(framePadding(m, "down").top).toBe(0);
  });
});
