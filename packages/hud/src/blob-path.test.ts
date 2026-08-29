import { HUD, joinOffsetForIndex, railLengthForCount } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { blobLayout, cardPath, railPath, tailPath } from "./blob-path.ts";

const railLength = railLengthForCount(3);
const join = joinOffsetForIndex(0);

describe("blobLayout", () => {
  it("keeps the right-edge rail flush to the canvas right", () => {
    const layout = blobLayout({
      cardGrowth: "left",
      railLength,
      joinOffset: join,
    });
    expect(layout.rail.x + layout.rail.width).toBe(layout.width);
    expect(layout.rail.x).toBe(HUD.cardWidth + HUD.joinWidth);
    expect(layout.card.x).toBe(0);
  });

  it("slides the card so the tail can point at the active meter", () => {
    const top = blobLayout({
      cardGrowth: "left",
      railLength,
      joinOffset: joinOffsetForIndex(0),
    });
    const mid = blobLayout({
      cardGrowth: "left",
      railLength,
      joinOffset: joinOffsetForIndex(1),
    });
    expect(mid.card.y).toBeGreaterThan(top.card.y);
    expect(mid.rail.x).toBe(top.rail.x);
  });
});

describe("blob paths", () => {
  it("closes the rail, card, and tail paths", () => {
    const layout = blobLayout({
      cardGrowth: "left",
      railLength,
      joinOffset: join,
    });
    expect(railPath("left", layout.rail).endsWith("Z")).toBe(true);
    expect(
      railPath("left", layout.rail, { joinOffset: join, progress: 1 }).endsWith(
        "Z",
      ),
    ).toBe(true);
    expect(cardPath(layout.card).endsWith("Z")).toBe(true);
    expect(tailPath("left", layout.card, layout.rail, join).endsWith("Z")).toBe(
      true,
    );
  });

  it("moves the tail with the join offset", () => {
    const layout = blobLayout({
      cardGrowth: "left",
      railLength,
      joinOffset: join,
    });
    const a = tailPath("left", layout.card, layout.rail, joinOffsetForIndex(0));
    const b = tailPath("left", layout.card, layout.rail, joinOffsetForIndex(2));
    expect(a).not.toBe(b);
  });
});
