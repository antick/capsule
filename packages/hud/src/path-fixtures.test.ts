import {
  cardHeightForBuckets,
  DOCK_STYLES,
  type DockStyleId,
  type HardwareNotch,
  hudMetrics,
  joinOffsetForIndex,
  railLengthForCount,
} from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import {
  blobLayout,
  bubblePath,
  type CardGrowth,
  framePadding,
  hitRegions,
  railPath,
} from "./blob-path.ts";
import {
  latchHotZone,
  latchRect,
  railMorph,
  restingRail,
  stowShift,
} from "./latch-path.ts";
import {
  mapperFor,
  mapRect,
  n,
  type Rect,
  roundedRect,
} from "./path-builder.ts";

/**
 * The dock's silhouettes, recorded from this implementation and read by the
 * Swift port. Cases name a dock — its edge, style, meters and the one that is
 * open — and both suites derive the metrics and the layout from that, so the
 * corpus never carries a layout a real dock could not have.
 */

interface Dock {
  scale: number;
  growth: CardGrowth;
  style: DockStyleId;
  meters: number;
  open: number;
  buckets: number;
  reserveBuckets?: number;
  railBias?: number;
}

function draw(dock: Dock) {
  const m = hudMetrics(dock.scale);
  const style = DOCK_STYLES[dock.style];
  const layout = blobLayout(m, {
    cardGrowth: dock.growth,
    railLength: railLengthForCount(m, dock.meters),
    joinOffset: joinOffsetForIndex(m, dock.open),
    cardHeight: cardHeightForBuckets(m, dock.buckets),
    cardReserve: dock.reserveBuckets
      ? cardHeightForBuckets(m, dock.reserveBuckets)
      : undefined,
    style,
    railBias: dock.railBias,
  });
  return { m, style, layout };
}

type Command =
  | { op: "M" | "L"; x: number; y: number }
  | { op: "A"; r: number; sweep: number; x: number; y: number }
  | {
      op: "C";
      c1: [number, number];
      c2: [number, number];
      x: number;
      y: number;
    }
  | { op: "Z" };

/**
 * An SVG path from the path builder, as commands. Strict on purpose: the
 * builder only ever writes M, L, A with equal radii and no rotation or large
 * arc, C and Z, so anything else means the format moved and the corpus would
 * silently stop describing it.
 */
function commands(d: string): Command[] {
  const tokens = d.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  const out: Command[] = [];
  let i = 0;
  const num = (): number => {
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error(`not a number in path: ${d}`);
    return value;
  };
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === "M" || op === "L") {
      out.push({ op, x: num(), y: num() });
    } else if (op === "A") {
      const r = num();
      const ry = num();
      const rotation = num();
      const large = num();
      const sweep = num();
      if (ry !== r || rotation !== 0 || large !== 0) {
        throw new Error(`arc the path builder does not write: ${d}`);
      }
      out.push({ op, r, sweep, x: num(), y: num() });
    } else if (op === "C") {
      out.push({
        op,
        c1: [num(), num()],
        c2: [num(), num()],
        x: num(),
        y: num(),
      });
    } else if (op === "Z") {
      out.push({ op });
    } else {
      throw new Error(`unexpected path command ${op}: ${d}`);
    }
  }
  return out;
}

goldenSuite("hud-paths/blob-layout", (dock: Dock) => draw(dock).layout);

goldenSuite("hud-paths/rail-path", (input: Dock & { notch: boolean }) => {
  const { m, style, layout } = draw(input);
  return commands(
    railPath(m, input.growth, layout, { notch: input.notch, style }),
  );
});

goldenSuite("hud-paths/bubble-path", (dock: Dock) => {
  const { m, layout } = draw(dock);
  return commands(bubblePath(m, dock.growth, layout));
});

goldenSuite(
  "hud-paths/frame-padding",
  (input: { scale: number; growth: CardGrowth; style: DockStyleId }) =>
    framePadding(
      hudMetrics(input.scale),
      input.growth,
      DOCK_STYLES[input.style],
    ),
);

goldenSuite(
  "hud-paths/hit-regions",
  (input: Dock & { state: "closed" | "open" | "latched" }) => {
    const { m, style, layout } = draw(input);
    const padding = framePadding(m, input.growth, style);
    return hitRegions(
      layout,
      padding,
      input.state === "open",
      input.state === "latched" ? latchHotZone(m, input.growth, layout) : null,
    );
  },
);

goldenSuite("hud-paths/latch", (input: Dock & { joined?: HardwareNotch }) => {
  const { m, layout } = draw(input);
  const joined = input.joined ?? null;
  return {
    resting: restingRail(m, layout, joined),
    latch: latchRect(m, input.growth, layout, joined),
    hotZone: latchHotZone(m, input.growth, layout, joined),
    stowShift: stowShift(m, input.growth),
  };
});

goldenSuite(
  "hud-paths/rail-morph",
  (
    input: Dock & {
      openness: number;
      notch?: boolean;
      joined?: HardwareNotch;
    },
  ) => {
    const { m, style, layout } = draw(input);
    const morph = railMorph(m, input.growth, layout, input.openness, {
      notch: input.notch,
      style,
      resting: input.joined ? restingRail(m, layout, input.joined) : undefined,
    });
    return {
      rail: morph.rail,
      path: commands(morph.path),
      clip: commands(morph.clip),
    };
  },
);

type Primitive =
  | { fn: "n"; value: number }
  | {
      fn: "mapper";
      growth: CardGrowth;
      canonicalWidth: number;
      points: [number, number][];
    }
  | { fn: "mapRect"; growth: CardGrowth; canonicalWidth: number; rect: Rect }
  | {
      fn: "roundedRect";
      growth: CardGrowth;
      canonicalWidth: number;
      rect: Rect;
      radius: number;
    };

goldenSuite("hud-paths/primitives", (input: Primitive) => {
  if (input.fn === "n") {
    const text = n(input.value);
    return { text, value: Number(text) };
  }
  const mapper = mapperFor(input.growth, input.canonicalWidth);
  if (input.fn === "mapper") {
    return {
      mirrored: mapper.mirrored,
      points: input.points.map(([x, y]) => mapper.point(x, y)),
    };
  }
  if (input.fn === "mapRect") {
    return mapRect(input.rect, input.growth, input.canonicalWidth);
  }
  return commands(roundedRect(mapper, input.rect, input.radius));
});
