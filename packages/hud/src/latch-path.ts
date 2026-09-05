import type { DockStyle, HardwareNotch, HudMetrics } from "@capsule/config";
import { type BlobLayout, type Rect, traceRail } from "./blob-path.ts";
import {
  type CardGrowth,
  type Mapper,
  mapperFor,
  mapRect,
} from "./path-builder.ts";

/**
 * The tab the dock folds down to, in the canonical frame: a sliver on the
 * rail's outer face, centred along it, so opening and closing share a centre
 * line and the dock never slides along the edge as it grows.
 */
export function restingRail(
  m: HudMetrics,
  layout: BlobLayout,
  joined: HardwareNotch | null = null,
): Rect {
  const rail = layout.canonical.rail;
  // Drawn as the display's own notch, the dock folds away to exactly that
  // notch — same width, same depth — so nothing shows at rest, and reaching
  // for it makes the notch itself grow. A separate tab hanging below the
  // hardware would be the very seam this placement exists to remove.
  const across = joined ? joined.height : m.latchThickness;
  const along = Math.min(joined ? joined.width : m.latchLength, rail.height);
  return {
    x: rail.x + rail.width - across,
    y: rail.y + (rail.height - along) / 2,
    width: across,
    height: along,
  };
}

/** The same tab, where it lands in the oriented frame. */
export function latchRect(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
  joined: HardwareNotch | null = null,
): Rect {
  return mapRect(
    restingRail(m, layout, joined),
    growth,
    layout.canonical.width,
  );
}

/**
 * The band a retracted dock answers to. The latch is only a few pixels thick,
 * so aiming at it would be a chore; the dock instead wakes for anywhere along
 * its own length within easy reach of the edge.
 */
export function latchHotZone(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
  joined: HardwareNotch | null = null,
): Rect {
  const latch = latchRect(m, growth, layout, joined);
  const reach = m.latchReach;
  // The latch itself plus a band reaching inward from it: across a hardware
  // notch that is the hole and the strip of screen just under it.
  if (growth === "left") {
    return { ...latch, x: latch.x - reach, width: latch.width + reach };
  }
  if (growth === "right") {
    return { ...latch, width: latch.width + reach };
  }
  if (growth === "up") {
    return { ...latch, y: latch.y - reach, height: latch.height + reach };
  }
  return { ...latch, height: latch.height + reach };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
  };
}

export interface RailMorph {
  /** The rail's rect at this point of the fold, in the canonical frame. */
  rail: Rect;
  /** Its outline, in frame coordinates. */
  path: string;
  /** The same outline in the rail box's own coordinates, for clipping. */
  clip: string;
}

/**
 * The rail part-way between its resting tab and its full length: `openness`
 * 0 is the latch, 1 the open rail.
 *
 * One shape grows out of the edge, rather than a tab fading while a rail
 * slides in behind it, so the dock never reads as two objects swapping. The
 * meters are clipped by this same outline, so they are swallowed by the shape
 * as it closes instead of sliding out of the end of it.
 */
export function railMorph(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
  openness: number,
  options: {
    notch?: boolean;
    style?: DockStyle;
    flare?: number;
    /** What the rail folds down to, when it is not the plain latch. */
    resting?: Rect;
  } = {},
): RailMorph {
  const base = layout.canonical;
  const k = Math.min(1, Math.max(0, openness));
  const resting = options.resting ?? restingRail(m, layout);
  const rail =
    k >= 1 ? base.rail : k <= 0 ? resting : lerpRect(resting, base.rail, k);
  const mapper = mapperFor(growth, base.width);
  const box = layout.rail;
  const local: Mapper = {
    point: (x, y) => {
      const [a, b] = mapper.point(x, y);
      return [a - box.x, b - box.y];
    },
    mirrored: mapper.mirrored,
  };
  return {
    rail,
    path: traceRail(m, mapper, rail, options),
    clip: traceRail(m, local, rail, options),
  };
}

/**
 * Which way, and how far, a meter slides toward the screen edge as the dock
 * folds. A short slide and no scaling: the outline is already doing the
 * concealing, and scaling on top of it reads as two effects fighting.
 */
export function stowShift(
  m: HudMetrics,
  growth: CardGrowth,
): { x: number; y: number } {
  const d = m.stowShift;
  if (growth === "left") {
    return { x: d, y: 0 };
  }
  if (growth === "right") {
    return { x: -d, y: 0 };
  }
  if (growth === "up") {
    return { x: 0, y: d };
  }
  return { x: 0, y: -d };
}
