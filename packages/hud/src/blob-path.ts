import {
  cardHeightForBuckets,
  DOCK_STYLES,
  type DockStyle,
  dockEdgeGap,
  type HudMetrics,
} from "@capsule/config";
import {
  type CardGrowth,
  type Mapper,
  mapperFor,
  mapRect,
  n,
  PathBuilder,
  type Rect,
  roundedRect,
} from "./path-builder.ts";

export type { CardGrowth, Mapper, Rect } from "./path-builder.ts";

interface CanonicalFrame {
  width: number;
  height: number;
  rail: Rect;
  card: Rect;
  joinY: number;
  tipX: number;
}

export interface BlobLayout {
  width: number;
  height: number;
  /** Rail body, excluding the concave flares that reach the screen edge. */
  rail: Rect;
  card: Rect;
  /** Point on the rail's inner edge that the tail aims at. */
  join: { x: number; y: number };
  /** Tail tip, used as the transform origin when the bubble opens. */
  tip: { x: number; y: number };
  /** The unmapped frame the silhouettes are traced in. */
  canonical: CanonicalFrame;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isVertical(growth: CardGrowth): boolean {
  return growth === "left" || growth === "right";
}

/**
 * The card is always read landscape, whichever edge the dock is on. In the
 * canonical frame the axis running away from the rail is "across" and the one
 * running along it is "along", so a horizontal dock simply swaps which side of
 * the card takes which role — rather than rotating the card with the frame.
 */
function cardExtent(
  m: HudMetrics,
  growth: CardGrowth,
  cardHeight: number,
): { cardAcross: number; cardAlong: number } {
  return isVertical(growth)
    ? { cardAcross: m.cardWidth, cardAlong: cardHeight }
    : { cardAcross: cardHeight, cardAlong: m.cardWidth };
}

/**
 * Canonical geometry: rail flush right, card to its left.
 *
 * The frame is traced against the reserved card extent rather than the card
 * actually being shown, because the window around it is sized once for the
 * tallest card any provider can produce. Tracing against a shorter card would
 * make the frame narrower than its window, and since the frame is pinned to
 * the docked edge the difference would hang off the far side and clip.
 */
function canonicalLayout(
  m: HudMetrics,
  input: {
    railLength: number;
    joinOffset: number;
    cardAcross: number;
    cardAlong: number;
    reserveAcross: number;
    reserveAlong: number;
    flare: number;
    railBias: number | null;
    /** How deep the rail is across, from the edge to its inner face. */
    railDepth: number;
  },
): CanonicalFrame {
  const width =
    input.reserveAcross + m.tailLength + m.joinGap + input.railDepth;
  const painted = input.railLength + input.flare * 2;
  const height = Math.max(painted, input.reserveAlong);
  const railX = input.reserveAcross + m.tailLength + m.joinGap;
  // Where the rail sits in the spare frame the card needs. Centred unless the
  // window has been stopped by a screen edge, in which case the placement
  // engine slides the rail on so it can still reach the corner.
  const bias = clamp(
    input.railBias ?? (height - painted) / 2,
    0,
    height - painted,
  );
  const railY = bias + input.flare;
  const joinY = railY + input.joinOffset;
  const cardY = clamp(
    joinY - input.cardAlong / 2,
    0,
    Math.max(0, height - input.cardAlong),
  );
  return {
    width,
    height,
    rail: {
      x: railX,
      y: railY,
      width: input.railDepth,
      height: input.railLength,
    },
    // The card keeps its own size but stays against the tail, so a short card
    // does not float away from the rail inside the reserved space.
    card: {
      x: input.reserveAcross - input.cardAcross,
      y: cardY,
      width: input.cardAcross,
      height: input.cardAlong,
    },
    joinY,
    // The tail lands on the rail rather than short of it, so the two
    // silhouettes read as one surface with no desktop showing between them.
    tipX: railX,
  };
}

export function blobLayout(
  m: HudMetrics,
  input: {
    cardGrowth: CardGrowth;
    railLength: number;
    joinOffset: number;
    cardHeight?: number;
    /** Tallest card the window was sized for; defaults to the card shown. */
    cardReserve?: number;
    style?: DockStyle;
    /** Rail offset inside the frame; centred when omitted. */
    railBias?: number | null;
    /**
     * The rail's depth across, when it is not the metrics' own: a bar drawn as
     * the display's notch is deeper by the notch's height, so its readings
     * start below the hole in the screen.
     */
    railDepth?: number;
    /** The concave fillet into the edge, when it is not the style's own. */
    flare?: number;
  },
): BlobLayout {
  const cardHeight = input.cardHeight ?? cardHeightForBuckets(m, 2);
  const growth = input.cardGrowth;
  const style = input.style ?? DOCK_STYLES.rail;
  const card = cardExtent(m, growth, cardHeight);
  const reserve = cardExtent(m, growth, input.cardReserve ?? cardHeight);
  const base = canonicalLayout(m, {
    railLength: input.railLength,
    joinOffset: input.joinOffset,
    ...card,
    reserveAcross: Math.max(reserve.cardAcross, card.cardAcross),
    reserveAlong: Math.max(reserve.cardAlong, card.cardAlong),
    flare: input.flare ?? m.edgeFlare * style.flare,
    railBias: input.railBias ?? null,
    railDepth: input.railDepth ?? m.railWidth,
  });
  const vertical = isVertical(growth);
  const mapper = mapperFor(growth, base.width);
  const [joinX, joinYMapped] = mapper.point(base.rail.x, base.joinY);
  const [tipX, tipY] = mapper.point(base.tipX, base.joinY);
  return {
    width: vertical ? base.width : base.height,
    height: vertical ? base.height : base.width,
    rail: mapRect(base.rail, growth, base.width),
    card: mapRect(base.card, growth, base.width),
    join: { x: joinX, y: joinYMapped },
    tip: { x: tipX, y: tipY },
    canonical: base,
  };
}

/** Corner radius the requested style wants on the rail. */
function railCornerRadius(
  m: HudMetrics,
  style: DockStyle,
  rail: Rect,
  notch: boolean,
): number {
  const base =
    style.radius === "pill"
      ? rail.width / 2
      : (notch ? m.notchRadius : m.railRadius) * style.radius;
  return Math.min(base, rail.width / 2, rail.height / 2);
}

/**
 * The rail. In the default style it is rounded on the inner side and blended
 * into the screen edge by a concave fillet at each end; as a notch the fillets
 * stay — they are what make it read as carved out of the screen rather than
 * stuck on top — but the corners tighten to match the menu bar. Styles that
 * float clear of the edge drop the fillets and close into a rounded slab.
 */
export function railPath(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
  options: {
    notch?: boolean;
    style?: DockStyle;
    rail?: Rect;
    flare?: number;
  } = {},
): string {
  const base = layout.canonical;
  return traceRail(
    m,
    mapperFor(growth, base.width),
    options.rail ?? base.rail,
    options,
  );
}

/**
 * The rail traced through `mapper`, for whatever rect it currently occupies —
 * the full rail, the resting latch, or anything the fold passes through.
 */
export function traceRail(
  m: HudMetrics,
  mapper: Mapper,
  rail: Rect,
  options: { notch?: boolean; style?: DockStyle; flare?: number } = {},
): string {
  const style = options.style ?? DOCK_STYLES.rail;
  const notch = options.notch ?? false;
  const wantedFlare = options.flare ?? m.edgeFlare * style.flare;
  // Order matters. The corner is claimed first, out of half the width, and
  // the flare takes what is left across; then the corner gives way to the
  // flare along the length. Letting the flare take the full width collapses
  // a thin shape into a self-crossing outline — and thin is exactly what the
  // rail is while it is folding out of its latch.
  const wanted = railCornerRadius(m, style, rail, notch);
  const flare = Math.max(
    0,
    Math.min(wantedFlare, rail.height / 2, rail.width - wanted),
  );
  const radius = Math.max(0, Math.min(wanted, (rail.height - 2 * flare) / 2));

  if (flare <= 0) {
    return roundedRect(mapper, rail, radius);
  }

  const outer = rail.x + rail.width;
  const inner = rail.x;
  const top = rail.y;
  const bottom = rail.y + rail.height;

  return new PathBuilder(mapper)
    .move(outer, top - flare)
    .arc(flare, 1, outer - flare, top)
    .line(inner + radius, top)
    .arc(radius, 0, inner, top + radius)
    .line(inner, bottom - radius)
    .arc(radius, 0, inner + radius, bottom)
    .line(outer - flare, bottom)
    .arc(flare, 1, outer, bottom + flare)
    .close()
    .toString();
}

/**
 * The card and its tail as one speech bubble. The tail runs all the way onto
 * the rail — and a hair past it, so antialiasing cannot leave a seam — because
 * any daylight between the two lets the desktop show through the join.
 */
export function bubblePath(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
): string {
  const base = layout.canonical;
  const mapper = mapperFor(growth, base.width);
  const card = base.card;
  const radius = Math.min(m.cardRadius, card.width / 2, card.height / 2);
  const edge = card.x + card.width;
  const half = Math.min(m.tailBase / 2, Math.max(0, card.height / 2 - radius));
  const length = base.tipX - edge + Math.max(1, m.unit);
  const cy = clamp(
    base.joinY,
    card.y + radius + half,
    card.y + card.height - radius - half,
  );
  const top = card.y;
  const bottom = card.y + card.height;

  return new PathBuilder(mapper)
    .move(card.x + radius, top)
    .line(edge - radius, top)
    .arc(radius, 1, edge, top + radius)
    .line(edge, cy - half)
    .curve(
      edge,
      cy - half * 0.6,
      edge + length * 0.49,
      cy - 2,
      edge + length,
      cy,
    )
    .curve(edge + length * 0.49, cy + 2, edge, cy + half * 0.6, edge, cy + half)
    .line(edge, bottom - radius)
    .arc(radius, 1, edge - radius, bottom)
    .line(card.x + radius, bottom)
    .arc(radius, 1, card.x, bottom - radius)
    .line(card.x, top + radius)
    .arc(radius, 1, card.x + radius, top)
    .close()
    .toString();
}

/**
 * Shadow gutter. The side that faces the screen edge carries only the gap the
 * dock style asks for, which is zero for the flush styles.
 */
export function framePadding(
  m: HudMetrics,
  growth: CardGrowth,
  style: DockStyle = DOCK_STYLES.rail,
): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const pad = m.shadowPadding;
  const gap = dockEdgeGap(m, style);
  if (growth === "left") {
    return { top: pad, right: gap, bottom: pad, left: pad };
  }
  if (growth === "right") {
    return { top: pad, right: pad, bottom: pad, left: gap };
  }
  if (growth === "up") {
    return { top: pad, right: pad, bottom: gap, left: pad };
  }
  return { top: gap, right: pad, bottom: pad, left: pad };
}

/** The tail tip, so the bubble scales out of the rail when it opens. */
export function bubbleOrigin(layout: BlobLayout): string {
  return `${n(layout.tip.x)}px ${n(layout.tip.y)}px`;
}

/** The same tip, for the card contents, which sit in their own box. */
export function cardOrigin(layout: BlobLayout): string {
  return `${n(layout.tip.x - layout.card.x)}px ${n(
    layout.tip.y - layout.card.y,
  )}px`;
}

/** Areas that should swallow the mouse, in coordinates local to the frame. */
export interface HitRegions {
  /** The rail alone, which is live whether or not a card is showing. */
  rail: Rect[];
  /**
   * Rail, tail and card as one block while the card is open. Reaching the card
   * means crossing the gap the tail spans, so that gap has to stay live too or
   * the pointer leaves the dock on the way over and the card closes itself.
   */
  open: Rect | null;
}

export function hitRegions(
  layout: BlobLayout,
  padding: { top: number; left: number },
  open: boolean,
  /** Set while the dock is retracted: only this band, around its latch, answers the mouse. */
  latchZone?: Rect | null,
): HitRegions {
  if (latchZone) {
    return {
      rail: [offsetRect(latchZone, padding.left, padding.top)],
      open: null,
    };
  }
  const rail = offsetRect(layout.rail, padding.left, padding.top);
  if (!open) {
    return { rail: [rail], open: null };
  }
  const card = offsetRect(layout.card, padding.left, padding.top);
  return { rail: [rail], open: unionRect(rail, card) };
}

function offsetRect(rect: Rect, dx: number, dy: number): Rect {
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height,
  };
}

function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
