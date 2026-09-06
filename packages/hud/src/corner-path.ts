import {
  type Corner,
  type CornerGeometry,
  type CornerGrowth,
  cornerAngle,
  cornerCapFor,
  cornerCardGrowth,
  cornerCardRect,
  cornerGeometry,
  cornerIsBottom,
  cornerIsRight,
  cornerMeterCentre,
  DOCK_STYLES,
  type DockStyle,
  dockEdgeGap,
  type HudMetrics,
} from "@capsule/config";
import type { Rect } from "./blob-path.ts";
import { type Mapper, PathBuilder, roundedRect } from "./path-builder.ts";

export interface CornerLayout {
  /** The drawing area, excluding the shadow gutter around it. */
  width: number;
  height: number;
  /** Padding between that area and the window, in frame order. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Meter centres, in rail order. */
  meters: { x: number; y: number }[];
  card: Rect;
  /** Where the card grows from: the active meter. */
  tip: { x: number; y: number };
  /** The arc band. */
  arc: string;
  /** Card and its spur, as one silhouette that merges into the band. */
  bubble: string;
  /** One live square per meter, so the empty inside of the arc stays clickable
   * through to whatever is under it. */
  hits: Rect[];
}

/**
 * Reflects the authored quadrant — corner at the origin, arc sweeping right
 * and down — into the corner actually in use. Reflecting on one axis reverses
 * every arc; reflecting on both puts them back.
 */
function mapperForCorner(g: CornerGeometry, corner: Corner): Mapper {
  const flipX = cornerIsRight(corner);
  const flipY = cornerIsBottom(corner);
  return {
    point: (x, y) => [flipX ? g.width - x : x, flipY ? g.height - y : y],
    mirrored: flipX !== flipY,
  };
}

function mapPoint(mapper: Mapper, p: { x: number; y: number }) {
  const [x, y] = mapper.point(p.x, p.y);
  return { x, y };
}

function mapRect(mapper: Mapper, rect: Rect): Rect {
  const a = mapper.point(rect.x, rect.y);
  const b = mapper.point(rect.x + rect.width, rect.y + rect.height);
  return {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    width: rect.width,
    height: rect.height,
  };
}

function polar(radius: number, angle: number): { x: number; y: number } {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/**
 * The band itself: a quarter ring bridging the two screen edges, traced
 * clockwise — out along the far radius, back along the near one. Styles that
 * float clear of the edge pull their ends back and round them off; flush
 * styles run all the way into both edges.
 */
export function cornerArcPath(g: CornerGeometry, mapper: Mapper): string {
  const start = g.cap;
  const end = Math.PI / 2 - g.cap;
  const capRadius = (g.outer - g.inner) / 2;
  const o0 = polar(g.outer, start);
  const o1 = polar(g.outer, end);
  const i0 = polar(g.inner, start);
  const i1 = polar(g.inner, end);
  const path = new PathBuilder(mapper)
    .move(o0.x, o0.y)
    .arc(g.outer, 1, o1.x, o1.y);
  if (g.cap > 0) {
    path.arc(capRadius, 1, i1.x, i1.y);
  } else {
    path.line(i1.x, i1.y);
  }
  path.arc(g.inner, 0, i0.x, i0.y);
  if (g.cap > 0) {
    path.arc(capRadius, 1, o0.x, o0.y);
  }
  return path.close().toString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Card plus the tail that reaches back into the band. The tail runs square
 * along the growth axis and stops at the meter's own centre — well inside the
 * band — so the two always overlap and no desktop shows in the join. Both
 * subpaths wind the same way, so filling them together unions them rather
 * than punching the tail out of the card.
 */
function cornerBubblePath(
  m: HudMetrics,
  mapper: Mapper,
  card: Rect,
  tip: { x: number; y: number },
  growth: CornerGrowth,
): string {
  const radius = Math.min(m.cardRadius, card.width / 2, card.height / 2);
  const body = roundedRect(mapper, card, radius);
  const tail = new PathBuilder(mapper);
  if (growth === "y") {
    // The card sits further down the authored frame than the band, so the
    // tail leaves its top edge and runs back up to the meter.
    const half = Math.min(m.tailBase / 2, Math.max(0, card.width / 2 - radius));
    const cx = clamp(
      tip.x,
      card.x + radius + half,
      card.x + card.width - radius - half,
    );
    tail
      .move(cx - half, card.y)
      .line(tip.x, tip.y)
      .line(cx + half, card.y)
      .close();
  } else {
    const half = Math.min(
      m.tailBase / 2,
      Math.max(0, card.height / 2 - radius),
    );
    const cy = clamp(
      tip.y,
      card.y + radius + half,
      card.y + card.height - radius - half,
    );
    tail
      .move(card.x, cy + half)
      .line(tip.x, tip.y)
      .line(card.x, cy - half)
      .close();
  }
  return `${body} ${tail.toString()}`;
}

export function cornerLayout(
  m: HudMetrics,
  input: {
    corner: Corner;
    meterCount: number;
    cardHeight: number;
    /** Tallest card the window was sized for. */
    cardReserve: number;
    activeIndex: number;
    style?: DockStyle;
    railThickness?: number;
  },
): CornerLayout {
  const style = input.style ?? DOCK_STYLES.rail;
  const gap = dockEdgeGap(m, style);
  const g = cornerGeometry(m, {
    meterCount: input.meterCount,
    cardWidth: m.cardWidth,
    cardHeight: Math.max(input.cardReserve, input.cardHeight),
    cap: cornerCapFor(m, style),
  });
  const mapper = mapperForCorner(g, input.corner);
  const card = cornerCardRect(
    g,
    m,
    input.activeIndex,
    m.cardWidth,
    input.cardHeight,
  );
  const growth = cornerCardGrowth(g, input.activeIndex);
  const tip = polar(g.radius, cornerAngle(g, input.activeIndex));
  const meters = g.angles.map((_, index) =>
    mapPoint(mapper, cornerMeterCentre(g, index)),
  );
  const band = m.railWidth;
  return {
    width: g.width,
    height: g.height,
    padding: {
      top: cornerIsBottom(input.corner) ? m.shadowPadding : gap,
      right: cornerIsRight(input.corner) ? gap : m.shadowPadding,
      bottom: cornerIsBottom(input.corner) ? gap : m.shadowPadding,
      left: cornerIsRight(input.corner) ? m.shadowPadding : gap,
    },
    meters,
    card: mapRect(mapper, card),
    tip: mapPoint(mapper, tip),
    arc: cornerArcPath(
      input.railThickness === undefined
        ? g
        : {
            ...g,
            inner: g.radius - input.railThickness / 2,
            outer: g.radius + input.railThickness / 2,
          },
      mapper,
    ),
    bubble: cornerBubblePath(m, mapper, card, tip, growth),
    hits: meters.map((centre) => ({
      x: centre.x - band / 2,
      y: centre.y - band / 2,
      width: band,
      height: band,
    })),
  };
}
