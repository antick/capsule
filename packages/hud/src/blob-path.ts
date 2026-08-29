import {
  cardHeightForBuckets,
  DOCK_STYLES,
  type DockStyle,
  dockEdgeGap,
  type HudMetrics,
} from "@capsule/config";

export type CardGrowth = "left" | "right" | "up" | "down";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * Every silhouette is authored once in a canonical frame — rail flush against
 * the right edge, meters stacked downward — then mapped into the requested
 * orientation. Mirroring transforms reverse arc sweeps.
 */
export interface Mapper {
  point: (x: number, y: number) => [number, number];
  mirrored: boolean;
}

function mapperFor(growth: CardGrowth, canonicalWidth: number): Mapper {
  if (growth === "right") {
    return {
      point: (x, y) => [canonicalWidth - x, y],
      mirrored: true,
    };
  }
  if (growth === "up") {
    return { point: (x, y) => [y, x], mirrored: true };
  }
  if (growth === "down") {
    return { point: (x, y) => [y, canonicalWidth - x], mirrored: false };
  }
  return { point: (x, y) => [x, y], mirrored: false };
}

function mapRect(rect: Rect, growth: CardGrowth, canonicalWidth: number): Rect {
  if (growth === "left") {
    return rect;
  }
  if (growth === "right") {
    return {
      x: canonicalWidth - (rect.x + rect.width),
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }
  if (growth === "up") {
    return {
      x: rect.y,
      y: rect.x,
      width: rect.height,
      height: rect.width,
    };
  }
  return {
    x: rect.y,
    y: canonicalWidth - (rect.x + rect.width),
    width: rect.height,
    height: rect.width,
  };
}

export class PathBuilder {
  private parts: string[] = [];

  constructor(private readonly mapper: Mapper) {}

  private at(x: number, y: number): string {
    const [a, b] = this.mapper.point(x, y);
    return `${n(a)} ${n(b)}`;
  }

  move(x: number, y: number): this {
    this.parts.push(`M ${this.at(x, y)}`);
    return this;
  }

  line(x: number, y: number): this {
    this.parts.push(`L ${this.at(x, y)}`);
    return this;
  }

  arc(radius: number, sweep: 0 | 1, x: number, y: number): this {
    const flag = this.mapper.mirrored ? 1 - sweep : sweep;
    this.parts.push(`A ${n(radius)} ${n(radius)} 0 0 ${flag} ${this.at(x, y)}`);
    return this;
  }

  curve(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): this {
    this.parts.push(
      `C ${this.at(c1x, c1y)}, ${this.at(c2x, c2y)}, ${this.at(x, y)}`,
    );
    return this;
  }

  close(): this {
    this.parts.push("Z");
    return this;
  }

  toString(): string {
    return this.parts.join(" ");
  }
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
  },
): CanonicalFrame {
  const width = input.reserveAcross + m.tailLength + m.joinGap + m.railWidth;
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
      width: m.railWidth,
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
    flare: m.edgeFlare * style.flare,
    railBias: input.railBias ?? null,
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

/** A plain rounded rectangle, traced clockwise in the canonical frame. */
export function roundedRect(
  mapper: Mapper,
  rect: Rect,
  radius: number,
): string {
  const r = Math.min(radius, rect.width / 2, rect.height / 2);
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  return new PathBuilder(mapper)
    .move(left + r, top)
    .line(right - r, top)
    .arc(r, 1, right, top + r)
    .line(right, bottom - r)
    .arc(r, 1, right - r, bottom)
    .line(left + r, bottom)
    .arc(r, 1, left, bottom - r)
    .line(left, top + r)
    .arc(r, 1, left + r, top)
    .close()
    .toString();
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
  options: { notch?: boolean; style?: DockStyle } = {},
): string {
  const style = options.style ?? DOCK_STYLES.rail;
  const notch = options.notch ?? false;
  const base = layout.canonical;
  const mapper = mapperFor(growth, base.width);
  const rail = base.rail;
  const radius = railCornerRadius(m, style, rail, notch);
  const flare = Math.min(m.edgeFlare * style.flare, rail.height / 2);

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
  /** Set while the dock is retracted: only its latch answers the mouse. */
  peek?: { metrics: HudMetrics; growth: CardGrowth } | null,
): HitRegions {
  if (peek) {
    const zone = latchHotZone(peek.metrics, peek.growth, layout);
    return {
      rail: [offsetRect(zone, padding.left, padding.top)],
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

/**
 * Which way the rail leaves the screen when the dock retracts, and how far it
 * has to travel to be gone. Overshooting the frame is deliberate: the window
 * clips it, and stopping exactly on the boundary leaves a hairline of surface
 * showing on styles that float clear of the edge.
 */
export function peekShift(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
): { x: number; y: number } {
  const over = m.shadowPadding;
  if (growth === "left") {
    return { x: layout.width - layout.rail.x + over, y: 0 };
  }
  if (growth === "right") {
    return { x: -(layout.rail.x + layout.rail.width + over), y: 0 };
  }
  if (growth === "up") {
    return { x: 0, y: layout.height - layout.rail.y + over };
  }
  return { x: 0, y: -(layout.rail.y + layout.rail.height + over) };
}

/** The tab left behind at the edge, sitting on the rail's outer face. */
export function latchRect(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
): Rect {
  const thick = m.latchThickness;
  const long = Math.min(m.latchLength, railSpan(growth, layout));
  const rail = layout.rail;
  if (growth === "left" || growth === "right") {
    return {
      x: growth === "left" ? rail.x + rail.width - thick : rail.x,
      y: rail.y + (rail.height - long) / 2,
      width: thick,
      height: long,
    };
  }
  return {
    x: rail.x + (rail.width - long) / 2,
    y: growth === "up" ? rail.y + rail.height - thick : rail.y,
    width: long,
    height: thick,
  };
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
): Rect {
  const latch = latchRect(m, growth, layout);
  const reach = m.latchReach;
  if (growth === "left") {
    return { ...latch, x: latch.x + latch.width - reach, width: reach };
  }
  if (growth === "right") {
    return { ...latch, width: reach };
  }
  if (growth === "up") {
    return { ...latch, y: latch.y + latch.height - reach, height: reach };
  }
  return { ...latch, height: reach };
}

function railSpan(growth: CardGrowth, layout: BlobLayout): number {
  return growth === "left" || growth === "right"
    ? layout.rail.height
    : layout.rail.width;
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
