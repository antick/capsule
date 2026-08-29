import {
  cardHeightForBuckets,
  DOCK_STYLES,
  dockEdgeGap,
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
  hitRegions,
  railPath,
} from "./blob-path.ts";

const m = hudMetrics(1);
const railLength = railLengthForCount(m, 3);
const cardHeight = cardHeightForBuckets(m, 2);
const growths: CardGrowth[] = ["left", "right", "up", "down"];

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

  it("slides the rail through the frame when the placement asks it to", () => {
    // The frame is longer than the rail whenever the card is, and the rail is
    // centred in the difference. Against a screen edge the window can go no
    // further, so the placement engine slides the rail on within the frame —
    // which is how the dock reaches a corner without taking the card with it.
    const tallCard = cardHeightForBuckets(m, 3);
    const centred = blobLayout(m, {
      cardGrowth: "left",
      railLength: 120,
      joinOffset: joinOffsetForIndex(m, 0),
      cardHeight: tallCard,
    });
    const slack = centred.height - (120 + m.edgeFlare * 2);
    expect(slack).toBeGreaterThan(0);

    const pushed = blobLayout(m, {
      cardGrowth: "left",
      railLength: 120,
      joinOffset: joinOffsetForIndex(m, 0),
      cardHeight: tallCard,
      railBias: slack,
    });
    expect(pushed.height).toBe(centred.height);
    expect(pushed.rail.y).toBe(slack + m.edgeFlare);
    expect(pushed.rail.y + pushed.rail.height + m.edgeFlare).toBe(
      pushed.height,
    );
    expect(pushed.card.y + pushed.card.height).toBeLessThanOrEqual(
      pushed.height,
    );
  });

  it("centres the card on the meter its tail points at", () => {
    const layout = layoutFor("left", 1);
    const centre = layout.card.y + layout.card.height / 2;
    expect(Math.abs(centre - layout.join.y)).toBeLessThanOrEqual(1);
  });

  it("keeps the tail on the card's flat side at the end meters", () => {
    // A card taller than the distance from the rail's end to its first meter
    // cannot centre on that meter without hanging out of the frame, so it
    // slides instead — but the tail still has to meet a flat edge.
    for (const index of [0, 2]) {
      const layout = layoutFor("left", index);
      expect(layout.card.y).toBeGreaterThanOrEqual(0);
      expect(layout.card.y + layout.card.height).toBeLessThanOrEqual(
        layout.height,
      );
      expect(layout.join.y).toBeGreaterThan(layout.card.y + m.cardRadius);
      expect(layout.join.y).toBeLessThan(
        layout.card.y + layout.card.height - m.cardRadius,
      );
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
    expect(railPath(m, "down", layout, { notch: true })).not.toBe(
      railPath(m, "down", layout, { notch: false }),
    );
    expect(railPath(m, "down", layout, { notch: true })).toContain(
      `A ${m.notchRadius} ${m.notchRadius}`,
    );
  });

  it("moves the tail when the open meter changes", () => {
    expect(bubblePath(m, "left", layoutFor("left", 0))).not.toBe(
      bubblePath(m, "left", layoutFor("left", 2)),
    );
  });
});

describe("dock styles", () => {
  it("drops the edge fillets for styles that float clear of the edge", () => {
    const layout = layoutFor("left", 0);
    const rail = railPath(m, "left", layout, { style: DOCK_STYLES.rail });
    const capsule = railPath(m, "left", layout, { style: DOCK_STYLES.capsule });
    // The rail starts a flare's distance above the rail body; a floating
    // silhouette starts on the body itself.
    expect(rail).toContain(`${layout.width} 0`);
    expect(capsule).not.toContain(`${layout.width} 0`);
    expect(capsule.endsWith("Z")).toBe(true);
    expect(capsule).not.toContain("NaN");
  });

  it("rounds the capsule to a half-width pill", () => {
    const layout = layoutFor("left", 0);
    const half = m.railWidth / 2;
    expect(
      railPath(m, "left", layout, { style: DOCK_STYLES.capsule }),
    ).toContain(`A ${half} ${half}`);
  });

  it("closes every style in every orientation", () => {
    for (const style of Object.values(DOCK_STYLES)) {
      for (const growth of growths) {
        const path = railPath(m, growth, layoutFor(growth, 1), { style });
        expect(path.endsWith("Z")).toBe(true);
        expect(path).not.toContain("NaN");
      }
    }
  });
});

describe("hitRegions", () => {
  const pad = framePadding(m, "left");

  it("offers only the rail while the card is closed", () => {
    const regions = hitRegions(layoutFor("left", 0), pad, false);
    expect(regions.open).toBeNull();
    expect(regions.rail.width).toBe(m.railWidth);
    expect(regions.rail.x).toBe(layoutFor("left", 0).rail.x + pad.left);
  });

  it("bridges the tail gap once the card is open", () => {
    const layout = layoutFor("left", 0);
    const regions = hitRegions(layout, pad, true);
    const gap = layout.rail.x - (layout.card.x + layout.card.width);
    expect(gap).toBeGreaterThan(0);
    // Losing the pointer while crossing the tail would close the card under
    // the cursor, so rail and card have to be one region.
    expect(regions.open?.x).toBe(layout.card.x + pad.left);
    expect(regions.open && regions.open.x + regions.open.width).toBe(
      layout.rail.x + layout.rail.width + pad.left,
    );
  });

  it("covers the card on every edge", () => {
    for (const growth of growths) {
      const layout = layoutFor(growth, 1);
      const padding = framePadding(m, growth);
      const open = hitRegions(layout, padding, true).open;
      expect(open).not.toBeNull();
      expect(open?.x).toBeLessThanOrEqual(layout.card.x + padding.left);
      expect(open && open.y + open.height).toBeGreaterThanOrEqual(
        layout.card.y + layout.card.height + padding.top,
      );
    }
  });
});

describe("framePadding", () => {
  it("drops the gutter on the flush side", () => {
    expect(framePadding(m, "left").right).toBe(0);
    expect(framePadding(m, "right").left).toBe(0);
    expect(framePadding(m, "up").bottom).toBe(0);
    expect(framePadding(m, "down").top).toBe(0);
  });

  it("holds a detached style off the edge instead", () => {
    const gap = dockEdgeGap(m, DOCK_STYLES.capsule);
    expect(gap).toBeGreaterThan(0);
    expect(framePadding(m, "left", DOCK_STYLES.capsule).right).toBe(gap);
    expect(framePadding(m, "down", DOCK_STYLES.capsule).top).toBe(gap);
  });
});
