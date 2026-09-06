import { HUD } from "./constants.ts";
import { type DockStyle, dockEdgeGap } from "./dock-style.ts";
import type { HudMetrics } from "./metrics.ts";
import type { Rect, ScreenEdge, SlideTrack } from "./placement.ts";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Corner curves are suspended; retain the implementation for later. */
export const CORNER_ARC_ENABLED = false;

export const CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const satisfies readonly Corner[];

/** The quadrant the arc sweeps through. */
const QUARTER = Math.PI / 2;

/**
 * The corner dock, authored once with the screen corner at the origin and the
 * arc sweeping through the quadrant below and to the right of it. Angles run
 * from the horizontal edge (0) to the vertical one (90 degrees); the renderer
 * reflects the whole thing into whichever corner is in use.
 */
export interface CornerGeometry {
  /** Frame the dock is drawn in, measured out from the screen corner. */
  width: number;
  height: number;
  /** Radius the meters are centred on. */
  radius: number;
  /** Band edges either side of that radius. */
  inner: number;
  outer: number;
  /** Where each meter sits, in rail order. */
  angles: number[];
  /** Angle the band's ends pull back by, for styles with rounded caps. */
  cap: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Radius that lets every meter sit on the arc with the rail's own padding at
 * each end of the quadrant. Meters keep the spacing they have on a straight
 * rail, so a corner dock and an edge dock read as the same object bent round.
 */
function arcRadius(m: HudMetrics, meterCount: number): number {
  const n = Math.max(1, meterCount);
  const needed =
    (n - 1) * (m.meterSize + m.itemGap) + m.meterSize + 2 * m.railPaddingY;
  return Math.max(needed / QUARTER, m.railWidth * HUD.cornerMinRadiusRatio);
}

/**
 * Which way the card leaves the arc: along whichever axis points away from the
 * screen edge the meter is nearest. A card that came straight out on the
 * radius would meet the band corner-first and trap a wedge of desktop between
 * the two; squaring it up against the band gives the same clean join the
 * straight dock has.
 */
export type CornerGrowth = "x" | "y";

export function cornerCardGrowth(
  g: CornerGeometry,
  index: number,
): CornerGrowth {
  return cornerAngle(g, index) <= QUARTER / 2 ? "y" : "x";
}

/**
 * How far along the growth axis the card's near edge sits. Measured from the
 * meter rather than from the band's boundary, so the tail is the same short
 * length wherever on the arc it leaves from.
 */
function cardOffset(m: HudMetrics): number {
  return m.railWidth / 2 + m.tailLength + m.joinGap;
}

/**
 * How far across the frame the card has to start to clear the band. The band
 * curves back over the meters near the ends of the arc, so a card centred on
 * one of those meters would be laid over its neighbours. Pushing it out to
 * where the band's outer edge crosses the card's near edge puts the whole card
 * outside the ring, whichever meter it belongs to, while the tail still runs
 * back under the band to the meter it came from.
 */
export function bandClearance(outer: number, near: number): number {
  return near < outer ? Math.sqrt(outer * outer - near * near) : 0;
}

export function cornerGeometry(
  m: HudMetrics,
  input: {
    meterCount: number;
    cardWidth: number;
    /** Tallest card any provider can produce; the frame is sized for it. */
    cardHeight: number;
    /** Radius of the band's end caps; zero leaves them cut flush. */
    cap?: number;
  },
): CornerGeometry {
  const n = Math.max(1, input.meterCount);
  const radius = arcRadius(m, n);
  const step = (m.meterSize + m.itemGap) / radius;
  // Centred on the diagonal, so the arc stays balanced whatever the count.
  const angles = Array.from(
    { length: n },
    (_, i) => QUARTER / 2 + (i - (n - 1) / 2) * step,
  );
  const inner = radius - m.railWidth / 2;
  const outer = radius + m.railWidth / 2;
  const offset = cardOffset(m);
  let width = outer;
  let height = outer;
  for (const angle of angles) {
    const centre = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    if (angle <= QUARTER / 2) {
      const near = centre.y + offset;
      width = Math.max(width, bandClearance(outer, near) + input.cardWidth);
      height = Math.max(height, near + input.cardHeight);
    } else {
      const near = centre.x + offset;
      width = Math.max(width, near + input.cardWidth);
      height = Math.max(height, bandClearance(outer, near) + input.cardHeight);
    }
  }
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    radius,
    inner,
    outer,
    angles,
    cap: Math.min(input.cap ?? 0, m.railWidth / 2) / radius,
  };
}

/** Angle the band's ends pull back by, which is a length on the arc. */
export function cornerCapFor(m: HudMetrics, style: DockStyle): number {
  return style.flare > 0 ? 0 : m.railWidth / 2;
}

/** The window a corner dock needs, its shadow gutter included. */
export function cornerWindowSize(
  m: HudMetrics,
  input: { meterCount: number; cardHeight: number; style: DockStyle },
): { width: number; height: number } {
  const gap = dockEdgeGap(m, input.style);
  const g = cornerGeometry(m, {
    meterCount: input.meterCount,
    cardWidth: m.cardWidth,
    cardHeight: input.cardHeight,
    cap: cornerCapFor(m, input.style),
  });
  return {
    width: Math.ceil(g.width + gap + m.shadowPadding),
    height: Math.ceil(g.height + gap + m.shadowPadding),
  };
}

export function cornerAngle(g: CornerGeometry, index: number): number {
  return g.angles[clamp(index, 0, g.angles.length - 1)] ?? QUARTER / 2;
}

/** Centre of the meter at `index`, in the authored frame. */
export function cornerMeterCentre(
  g: CornerGeometry,
  index: number,
): { x: number; y: number } {
  const angle = cornerAngle(g, index);
  return { x: g.radius * Math.cos(angle), y: g.radius * Math.sin(angle) };
}

/**
 * The card for the meter at `index`: squared up against the band on the growth
 * axis, centred on the meter across it, and pushed clear of the ring and out
 * of the frame's edges if either gets in the way.
 */
export function cornerCardRect(
  g: CornerGeometry,
  m: HudMetrics,
  index: number,
  width: number,
  height: number,
): Rect {
  const centre = cornerMeterCentre(g, index);
  const offset = cardOffset(m);
  const across = (start: number, span: number, frame: number, min: number) =>
    clamp(start - span / 2, min, Math.max(min, frame - span));
  if (cornerCardGrowth(g, index) === "y") {
    const y = centre.y + offset;
    return {
      x: across(centre.x, width, g.width, bandClearance(g.outer, y)),
      y,
      width,
      height,
    };
  }
  const x = centre.x + offset;
  return {
    x,
    y: across(centre.y, height, g.height, bandClearance(g.outer, x)),
    width,
    height,
  };
}

/**
 * Which corner the rail has reached, if any. The rail travels the whole
 * physical edge, so being at either end of its track means being in a corner.
 */
export function cornerForRail(
  edge: ScreenEdge,
  slide: SlideTrack,
  railStart: number,
  snapPx: number,
): Corner | null {
  const atStart = railStart <= slide.min + snapPx;
  const atEnd = railStart >= slide.max - snapPx;
  if (!atStart && !atEnd) {
    return null;
  }
  // Ends are ordered along the axis: top before bottom, left before right.
  if (edge === "right") {
    return atStart ? "top-right" : "bottom-right";
  }
  if (edge === "left") {
    return atStart ? "top-left" : "bottom-left";
  }
  if (edge === "top") {
    return atStart ? "top-left" : "top-right";
  }
  return atStart ? "bottom-left" : "bottom-right";
}

/**
 * The inverse: where on the track a curled dock re-enters when it uncurls.
 * Picking the end it curled from is what stops a corner dock from jumping
 * across the screen the moment it is grabbed.
 */
export function railStartForCorner(slide: SlideTrack, corner: Corner): number {
  const atEnd =
    slide.axis === "y" ? cornerIsBottom(corner) : cornerIsRight(corner);
  return atEnd ? slide.max : slide.min;
}

export function cornerIsRight(corner: Corner): boolean {
  return corner === "top-right" || corner === "bottom-right";
}

export function cornerIsBottom(corner: Corner): boolean {
  return corner === "bottom-left" || corner === "bottom-right";
}
