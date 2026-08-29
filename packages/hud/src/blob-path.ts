import { cardHeightForBuckets, type HudMetrics } from "@capsule/config";

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
interface Mapper {
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

class PathBuilder {
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

/** Canonical geometry: rail flush right, card to its left. */
function canonicalLayout(
  m: HudMetrics,
  input: {
    railLength: number;
    joinOffset: number;
    cardAcross: number;
    cardAlong: number;
  },
): CanonicalFrame {
  const flare = m.edgeFlare;
  const width = input.cardAcross + m.tailLength + m.joinGap + m.railWidth;
  const height = Math.max(input.railLength + flare * 2, input.cardAlong);
  const railX = input.cardAcross + m.tailLength + m.joinGap;
  const railY = (height - input.railLength) / 2;
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
    card: { x: 0, y: cardY, width: input.cardAcross, height: input.cardAlong },
    joinY,
    tipX: input.cardAcross + m.tailLength,
  };
}

export function blobLayout(
  m: HudMetrics,
  input: {
    cardGrowth: CardGrowth;
    railLength: number;
    joinOffset: number;
    cardHeight?: number;
  },
): BlobLayout {
  const cardHeight = input.cardHeight ?? cardHeightForBuckets(m, 2);
  const growth = input.cardGrowth;
  const base = canonicalLayout(m, {
    railLength: input.railLength,
    joinOffset: input.joinOffset,
    ...cardExtent(m, growth, cardHeight),
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

/**
 * The rail: rounded on the inner side, and blended into the screen edge it
 * rests against by a concave fillet at each end. As a notch the fillets stay —
 * they are what make it read as carved out of the screen rather than stuck on
 * top — but the corners tighten so it matches the menu-bar silhouette.
 */
export function railPath(
  m: HudMetrics,
  growth: CardGrowth,
  layout: BlobLayout,
  notch = false,
): string {
  const base = layout.canonical;
  const mapper = mapperFor(growth, base.width);
  const rail = base.rail;
  const outer = rail.x + rail.width;
  const inner = rail.x;
  const top = rail.y;
  const bottom = rail.y + rail.height;
  const cornerBase = notch ? m.notchRadius : m.railRadius;
  const radius = Math.min(cornerBase, rail.width / 2, rail.height / 2);
  const flare = Math.min(m.edgeFlare, rail.height / 2);

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
 * The card and its tail as one speech bubble. The tail is a sharp spur that
 * stops short of the rail rather than merging into it.
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
  const length = m.tailLength;
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

/** Shadow gutter, omitted on the side that sits flush against the screen. */
export function framePadding(
  m: HudMetrics,
  growth: CardGrowth,
): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const pad = m.shadowPadding;
  if (growth === "left") {
    return { top: pad, right: 0, bottom: pad, left: pad };
  }
  if (growth === "right") {
    return { top: pad, right: pad, bottom: pad, left: 0 };
  }
  if (growth === "up") {
    return { top: pad, right: pad, bottom: 0, left: pad };
  }
  return { top: 0, right: pad, bottom: pad, left: pad };
}

/** The tail tip, so the bubble scales out of the rail when it opens. */
export function bubbleOrigin(layout: BlobLayout): string {
  return `${n(layout.tip.x)}px ${n(layout.tip.y)}px`;
}
