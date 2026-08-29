import {
  cardHeightForBuckets,
  HUD,
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

const railLength = railLengthForCount(3);
const cardHeight = cardHeightForBuckets(2);

function layoutFor(cardGrowth: CardGrowth, index: number) {
  return blobLayout({
    cardGrowth,
    railLength,
    joinOffset: joinOffsetForIndex(index),
    cardHeight,
  });
}

describe("blobLayout", () => {
  it("keeps a right-edge rail flush with the canvas edge", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.x + layout.rail.width).toBe(layout.width);
    expect(layout.card.x).toBe(0);
    expect(layout.rail.width).toBe(HUD.railWidth);
  });

  it("leaves a visible gap between the tail tip and the rail", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.x - layout.tip.x).toBe(HUD.joinGap);
    expect(layout.tip.x - (layout.card.x + layout.card.width)).toBe(
      HUD.tailLength,
    );
  });

  it("reserves room for the flares at both ends of the rail", () => {
    const layout = layoutFor("left", 0);
    expect(layout.rail.y).toBe(HUD.edgeFlare);
    expect(layout.height).toBe(railLength + HUD.edgeFlare * 2);
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

  it("transposes the frame for horizontal edges", () => {
    const vertical = layoutFor("left", 0);
    const horizontal = layoutFor("up", 0);
    expect(horizontal.width).toBe(vertical.height);
    expect(horizontal.height).toBe(vertical.width);
    expect(horizontal.rail.y + horizontal.rail.height).toBe(horizontal.height);
    expect(horizontal.card.y).toBe(0);
  });

  it("mirrors the rail to the near side for left-edge docks", () => {
    const layout = layoutFor("right", 0);
    expect(layout.rail.x).toBe(0);
    expect(layout.card.x + layout.card.width).toBe(layout.width);
    expect(layout.tip.x - layout.rail.width).toBe(HUD.joinGap);
  });
});

describe("silhouettes", () => {
  const growths: CardGrowth[] = ["left", "right", "up", "down"];

  it("closes both shapes in every orientation", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth, 1);
      expect(railPath(growth, layout).endsWith("Z")).toBe(true);
      expect(
        bubblePath(growth, layout, joinOffsetForIndex(1), cardHeight).endsWith(
          "Z",
        ),
      ).toBe(true);
    }
  });

  it("emits no NaN coordinates", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth, 2);
      expect(railPath(growth, layout)).not.toContain("NaN");
      expect(
        bubblePath(growth, layout, joinOffsetForIndex(2), cardHeight),
      ).not.toContain("NaN");
    }
  });

  it("runs the rail's flush side straight along the canvas edge", () => {
    const layout = layoutFor("left", 0);
    const right = layout.width;
    const path = railPath("left", layout);
    expect(path.startsWith(`M ${right} ${HUD.edgeFlare - HUD.edgeFlare}`)).toBe(
      true,
    );
    expect(path).toContain(`${right} ${layout.height}`);
  });

  it("moves the tail when the open meter changes", () => {
    const layout = layoutFor("left", 0);
    const first = bubblePath("left", layout, joinOffsetForIndex(0), cardHeight);
    const third = bubblePath("left", layout, joinOffsetForIndex(2), cardHeight);
    expect(first).not.toBe(third);
  });
});

describe("framePadding", () => {
  it("drops the gutter on the flush side", () => {
    expect(framePadding("left").right).toBe(0);
    expect(framePadding("right").left).toBe(0);
    expect(framePadding("up").bottom).toBe(0);
    expect(framePadding("down").top).toBe(0);
  });
});
