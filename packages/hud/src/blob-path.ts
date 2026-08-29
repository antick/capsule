import { HUD } from "@capsule/config";

export type CardGrowth = "left" | "right" | "up" | "down";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlobLayout {
  width: number;
  height: number;
  rail: Rect;
  card: Rect;
  join: { x: number; y: number };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function n(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

export function cardOriginAlongRail(
  joinOffset: number,
  railLength: number,
  along: number,
): number {
  return clamp(
    joinOffset - HUD.cardTailOffsetY,
    0,
    Math.max(0, railLength - along),
  );
}

export function blobLayout(input: {
  cardGrowth: CardGrowth;
  railLength: number;
  joinOffset: number;
  cardHeight?: number;
}): BlobLayout {
  const { cardGrowth, railLength, joinOffset } = input;
  const cardHeight = input.cardHeight ?? HUD.cardHeight;
  const vertical = cardGrowth === "left" || cardGrowth === "right";
  const along = vertical ? cardHeight : HUD.cardWidth;
  const origin = cardOriginAlongRail(joinOffset, railLength, along);

  if (cardGrowth === "left") {
    return {
      width: HUD.cardWidth + HUD.joinWidth + HUD.railWidth,
      height: railLength,
      card: {
        x: 0,
        y: origin,
        width: HUD.cardWidth,
        height: cardHeight,
      },
      rail: {
        x: HUD.cardWidth + HUD.joinWidth,
        y: 0,
        width: HUD.railWidth,
        height: railLength,
      },
      join: { x: HUD.cardWidth + HUD.joinWidth, y: joinOffset },
    };
  }

  if (cardGrowth === "right") {
    return {
      width: HUD.cardWidth + HUD.joinWidth + HUD.railWidth,
      height: railLength,
      rail: {
        x: 0,
        y: 0,
        width: HUD.railWidth,
        height: railLength,
      },
      card: {
        x: HUD.railWidth + HUD.joinWidth,
        y: origin,
        width: HUD.cardWidth,
        height: cardHeight,
      },
      join: { x: HUD.railWidth, y: joinOffset },
    };
  }

  if (cardGrowth === "up") {
    return {
      width: railLength,
      height: cardHeight + HUD.joinWidth + HUD.railWidth,
      card: {
        x: origin,
        y: 0,
        width: HUD.cardWidth,
        height: cardHeight,
      },
      rail: {
        x: 0,
        y: cardHeight + HUD.joinWidth,
        width: railLength,
        height: HUD.railWidth,
      },
      join: { x: joinOffset, y: cardHeight + HUD.joinWidth },
    };
  }

  return {
    width: railLength,
    height: cardHeight + HUD.joinWidth + HUD.railWidth,
    rail: {
      x: 0,
      y: 0,
      width: railLength,
      height: HUD.railWidth,
    },
    card: {
      x: origin,
      y: HUD.railWidth + HUD.joinWidth,
      width: HUD.cardWidth,
      height: cardHeight,
    },
    join: { x: joinOffset, y: HUD.railWidth },
  };
}

export function flushClipRect(growth: CardGrowth, layout: BlobLayout): Rect {
  const pad = 200;
  if (growth === "left") {
    return {
      x: -pad,
      y: -pad,
      width: layout.width + pad,
      height: layout.height + pad * 2,
    };
  }
  if (growth === "right") {
    return {
      x: 0,
      y: -pad,
      width: layout.width + pad,
      height: layout.height + pad * 2,
    };
  }
  if (growth === "up") {
    return {
      x: -pad,
      y: -pad,
      width: layout.width + pad * 2,
      height: layout.height + pad,
    };
  }
  return {
    x: -pad,
    y: 0,
    width: layout.width + pad * 2,
    height: layout.height + pad,
  };
}

export function flushPadding(growth: CardGrowth): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const pad = HUD.shadowPadding;
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

export function railPath(
  growth: CardGrowth,
  rail: Rect,
  bite?: { joinOffset: number; progress: number },
): string {
  const r = Math.min(HUD.railRadius, rail.width / 2, rail.height / 2);
  const biteRadius =
    bite && bite.progress > 0.02
      ? HUD.biteRadius * Math.min(1, bite.progress)
      : 0;
  return flushRailPath(growth, rail, r, biteRadius, bite?.joinOffset ?? 0);
}

function flushRailPath(
  growth: CardGrowth,
  rail: Rect,
  corner: number,
  bite: number,
  joinOffset: number,
): string {
  const { x, y, width: w, height: h } = rail;
  if (growth === "left" || growth === "right") {
    const innerX = growth === "left" ? x : x + w;
    const outerX = growth === "left" ? x + w : x;
    const inset = growth === "left" ? corner : -corner;
    const sweep = growth === "left" ? 1 : 0;
    const maxBite = Math.max(1, (h - corner * 2) / 2);
    const radius = Math.min(bite, maxBite);
    const cy = clamp(joinOffset, y + corner + radius, y + h - corner - radius);
    const into = growth === "left" ? 0 : 1;
    const parts = [
      `M ${n(outerX)} ${n(y)}`,
      `L ${n(outerX)} ${n(y + h)}`,
      `L ${n(innerX + inset)} ${n(y + h)}`,
      `A ${n(corner)} ${n(corner)} 0 0 ${sweep} ${n(innerX)} ${n(y + h - corner)}`,
    ];
    if (radius > 0.5) {
      parts.push(`L ${n(innerX)} ${n(cy + radius)}`);
      parts.push(
        `A ${n(radius)} ${n(radius)} 0 0 ${into} ${n(innerX)} ${n(cy - radius)}`,
      );
    }
    parts.push(
      `L ${n(innerX)} ${n(y + corner)}`,
      `A ${n(corner)} ${n(corner)} 0 0 ${sweep} ${n(innerX + inset)} ${n(y)}`,
      "Z",
    );
    return parts.join(" ");
  }

  const innerY = growth === "up" ? y : y + h;
  const outerY = growth === "up" ? y + h : y;
  const inset = growth === "up" ? -corner : corner;
  const sweep = growth === "up" ? 1 : 0;
  const maxBite = Math.max(1, (w - corner * 2) / 2);
  const radius = Math.min(bite, maxBite);
  const cx = clamp(joinOffset, x + corner + radius, x + w - corner - radius);
  const into = growth === "up" ? 0 : 1;
  const parts = [
    `M ${n(x)} ${n(outerY)}`,
    `L ${n(x + w)} ${n(outerY)}`,
    `L ${n(x + w)} ${n(innerY + inset)}`,
    `A ${n(corner)} ${n(corner)} 0 0 ${sweep} ${n(x + w - corner)} ${n(innerY)}`,
  ];
  if (radius > 0.5) {
    parts.push(`L ${n(cx + radius)} ${n(innerY)}`);
    parts.push(
      `A ${n(radius)} ${n(radius)} 0 0 ${into} ${n(cx - radius)} ${n(innerY)}`,
    );
  }
  parts.push(
    `L ${n(x + corner)} ${n(innerY)}`,
    `A ${n(corner)} ${n(corner)} 0 0 ${sweep} ${n(x)} ${n(innerY + inset)}`,
    "Z",
  );
  return parts.join(" ");
}

export function cardPath(card: Rect): string {
  const r = Math.min(HUD.cardRadius, card.width / 2, card.height / 2);
  return roundedRectPath(card, { tl: r, tr: r, br: r, bl: r });
}

export function tailPath(
  growth: CardGrowth,
  card: Rect,
  rail: Rect,
  joinOffset: number,
): string {
  const half = HUD.tailBase / 2;
  const ctrl = HUD.tailControl;
  const overlap = HUD.biteRadius;

  if (growth === "left" || growth === "right") {
    const fromRight = growth === "left";
    const out = fromRight ? 1 : -1;
    const baseX = fromRight ? card.x + card.width - 1 : card.x + 1;
    const tipX = fromRight ? rail.x + overlap : rail.x + rail.width - overlap;
    const minY = card.y + HUD.cardRadius;
    const maxY = card.y + card.height - HUD.cardRadius;
    const top = clamp(joinOffset - half, minY, maxY);
    const bot = clamp(joinOffset + half, minY, maxY);
    const tipY = clamp(joinOffset, minY, maxY);
    const reach = Math.abs(tipX - baseX);
    return [
      `M ${n(baseX)} ${n(top)}`,
      `C ${n(baseX + out * reach * 0.28)} ${n(top + ctrl)}, ${n(tipX - out * 6)} ${n(tipY - 2)}, ${n(tipX)} ${n(tipY)}`,
      `C ${n(tipX - out * 6)} ${n(tipY + 2)}, ${n(baseX + out * reach * 0.28)} ${n(bot - ctrl)}, ${n(baseX)} ${n(bot)}`,
      "Z",
    ].join(" ");
  }

  const fromBottom = growth === "up";
  const out = fromBottom ? 1 : -1;
  const baseY = fromBottom ? card.y + card.height - 1 : card.y + 1;
  const tipY = fromBottom ? rail.y + overlap : rail.y + rail.height - overlap;
  const minX = card.x + HUD.cardRadius;
  const maxX = card.x + card.width - HUD.cardRadius;
  const left = clamp(joinOffset - half, minX, maxX);
  const right = clamp(joinOffset + half, minX, maxX);
  const tipX = clamp(joinOffset, minX, maxX);
  const reach = Math.abs(tipY - baseY);
  return [
    `M ${n(left)} ${n(baseY)}`,
    `C ${n(left + ctrl)} ${n(baseY + out * reach * 0.28)}, ${n(tipX - 2)} ${n(tipY - out * 6)}, ${n(tipX)} ${n(tipY)}`,
    `C ${n(tipX + 2)} ${n(tipY - out * 6)}, ${n(right - ctrl)} ${n(baseY + out * reach * 0.28)}, ${n(right)} ${n(baseY)}`,
    "Z",
  ].join(" ");
}

export function connectedPath(
  growth: CardGrowth,
  layout: BlobLayout,
  joinOffset: number,
): string {
  if (growth === "left" || growth === "right") {
    return connectedVertical(growth, layout, joinOffset);
  }
  return connectedHorizontal(growth, layout, joinOffset);
}

function connectedVertical(
  growth: "left" | "right",
  layout: BlobLayout,
  joinOffset: number,
): string {
  const { card, rail } = layout;
  const cr = Math.min(HUD.cardRadius, card.width / 2, card.height / 2);
  const rr = Math.min(HUD.railRadius, rail.width / 2, rail.height / 2);
  const bite = Math.min(
    HUD.biteRadius,
    Math.max(1, (rail.height - rr * 2) / 2),
  );
  const innerX = growth === "left" ? rail.x : rail.x + rail.width;
  const outerX = growth === "left" ? rail.x + rail.width : rail.x;
  const inset = growth === "left" ? rr : -rr;
  const sweep = growth === "left" ? 1 : 0;
  const into = growth === "left" ? 0 : 1;
  const tipX = growth === "left" ? innerX + bite : innerX - bite;
  const cardEdge = growth === "left" ? card.x + card.width : card.x;
  const cy = clamp(
    joinOffset,
    rail.y + rr + bite,
    rail.y + rail.height - rr - bite,
  );
  const half = HUD.tailBase / 2;
  const tailTop = clamp(cy - half, card.y + cr, card.y + card.height - cr);
  const tailBot = clamp(cy + half, card.y + cr, card.y + card.height - cr);
  const reach = Math.abs(tipX - cardEdge);
  const out = growth === "left" ? 1 : -1;
  const neck = HUD.tailControl;

  return [
    `M ${n(outerX)} ${n(rail.y)}`,
    `L ${n(outerX)} ${n(rail.y + rail.height)}`,
    `L ${n(innerX + inset)} ${n(rail.y + rail.height)}`,
    `A ${n(rr)} ${n(rr)} 0 0 ${sweep} ${n(innerX)} ${n(rail.y + rail.height - rr)}`,
    `L ${n(innerX)} ${n(cy + bite)}`,
    `A ${n(bite)} ${n(bite)} 0 0 ${into} ${n(tipX)} ${n(cy)}`,
    `C ${n(tipX - out * bite * 0.45)} ${n(cy + neck)}, ${n(cardEdge + out * reach * 0.35)} ${n(tailBot)}, ${n(cardEdge)} ${n(tailBot)}`,
    `L ${n(cardEdge)} ${n(card.y + card.height - cr)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(cardEdge - out * cr)} ${n(card.y + card.height)}`,
    `L ${n(card.x + (growth === "left" ? cr : card.width - cr))} ${n(card.y + card.height)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(growth === "left" ? card.x : card.x + card.width)} ${n(card.y + card.height - cr)}`,
    `L ${n(growth === "left" ? card.x : card.x + card.width)} ${n(card.y + cr)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(card.x + (growth === "left" ? cr : card.width - cr))} ${n(card.y)}`,
    `L ${n(cardEdge - out * cr)} ${n(card.y)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(cardEdge)} ${n(card.y + cr)}`,
    `L ${n(cardEdge)} ${n(tailTop)}`,
    `C ${n(cardEdge + out * reach * 0.35)} ${n(tailTop)}, ${n(tipX - out * bite * 0.45)} ${n(cy - neck)}, ${n(tipX)} ${n(cy)}`,
    `A ${n(bite)} ${n(bite)} 0 0 ${into} ${n(innerX)} ${n(cy - bite)}`,
    `L ${n(innerX)} ${n(rail.y + rr)}`,
    `A ${n(rr)} ${n(rr)} 0 0 ${sweep} ${n(innerX + inset)} ${n(rail.y)}`,
    "Z",
  ].join(" ");
}

function connectedHorizontal(
  growth: "up" | "down",
  layout: BlobLayout,
  joinOffset: number,
): string {
  const { card, rail } = layout;
  const cr = Math.min(HUD.cardRadius, card.width / 2, card.height / 2);
  const rr = Math.min(HUD.railRadius, rail.width / 2, rail.height / 2);
  const bite = Math.min(HUD.biteRadius, Math.max(1, (rail.width - rr * 2) / 2));
  const innerY = growth === "up" ? rail.y : rail.y + rail.height;
  const outerY = growth === "up" ? rail.y + rail.height : rail.y;
  const inset = growth === "up" ? -rr : rr;
  const sweep = growth === "up" ? 1 : 0;
  const into = growth === "up" ? 0 : 1;
  const tipY = growth === "up" ? innerY + bite : innerY - bite;
  const cardEdge = growth === "up" ? card.y + card.height : card.y;
  const cx = clamp(
    joinOffset,
    rail.x + rr + bite,
    rail.x + rail.width - rr - bite,
  );
  const half = HUD.tailBase / 2;
  const tailLeft = clamp(cx - half, card.x + cr, card.x + card.width - cr);
  const tailRight = clamp(cx + half, card.x + cr, card.x + card.width - cr);
  const reach = Math.abs(tipY - cardEdge);
  const out = growth === "up" ? 1 : -1;
  const neck = HUD.tailControl;

  return [
    `M ${n(rail.x)} ${n(outerY)}`,
    `L ${n(rail.x + rail.width)} ${n(outerY)}`,
    `L ${n(rail.x + rail.width)} ${n(innerY + inset)}`,
    `A ${n(rr)} ${n(rr)} 0 0 ${sweep} ${n(rail.x + rail.width - rr)} ${n(innerY)}`,
    `L ${n(cx + bite)} ${n(innerY)}`,
    `A ${n(bite)} ${n(bite)} 0 0 ${into} ${n(cx)} ${n(tipY)}`,
    `C ${n(cx + neck)} ${n(tipY - out * bite * 0.45)}, ${n(tailRight)} ${n(cardEdge + out * reach * 0.35)}, ${n(tailRight)} ${n(cardEdge)}`,
    `L ${n(card.x + card.width - cr)} ${n(cardEdge)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(card.x + card.width)} ${n(cardEdge - out * cr)}`,
    `L ${n(card.x + card.width)} ${n(growth === "up" ? card.y + cr : card.y + card.height - cr)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(card.x + card.width - cr)} ${n(growth === "up" ? card.y : card.y + card.height)}`,
    `L ${n(card.x + cr)} ${n(growth === "up" ? card.y : card.y + card.height)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(card.x)} ${n(growth === "up" ? card.y + cr : card.y + card.height - cr)}`,
    `L ${n(card.x)} ${n(cardEdge - out * cr)}`,
    `A ${n(cr)} ${n(cr)} 0 0 ${sweep} ${n(card.x + cr)} ${n(cardEdge)}`,
    `L ${n(tailLeft)} ${n(cardEdge)}`,
    `C ${n(tailLeft)} ${n(cardEdge + out * reach * 0.35)}, ${n(cx - neck)} ${n(tipY - out * bite * 0.45)}, ${n(cx)} ${n(tipY)}`,
    `A ${n(bite)} ${n(bite)} 0 0 ${into} ${n(cx - bite)} ${n(innerY)}`,
    `L ${n(rail.x + rr)} ${n(innerY)}`,
    `A ${n(rr)} ${n(rr)} 0 0 ${sweep} ${n(rail.x)} ${n(innerY + inset)}`,
    "Z",
  ].join(" ");
}

export function roundedRectPath(
  rect: Rect,
  radii: { tl: number; tr: number; br: number; bl: number },
): string {
  const { x, y, width: w, height: h } = rect;
  const tl = Math.max(0, radii.tl);
  const tr = Math.max(0, radii.tr);
  const br = Math.max(0, radii.br);
  const bl = Math.max(0, radii.bl);
  const parts = [`M ${n(x + tl)} ${n(y)}`, `L ${n(x + w - tr)} ${n(y)}`];
  if (tr > 0) {
    parts.push(`A ${n(tr)} ${n(tr)} 0 0 1 ${n(x + w)} ${n(y + tr)}`);
  } else {
    parts.push(`L ${n(x + w)} ${n(y)}`);
  }
  parts.push(`L ${n(x + w)} ${n(y + h - br)}`);
  if (br > 0) {
    parts.push(`A ${n(br)} ${n(br)} 0 0 1 ${n(x + w - br)} ${n(y + h)}`);
  } else {
    parts.push(`L ${n(x + w)} ${n(y + h)}`);
  }
  parts.push(`L ${n(x + bl)} ${n(y + h)}`);
  if (bl > 0) {
    parts.push(`A ${n(bl)} ${n(bl)} 0 0 1 ${n(x)} ${n(y + h - bl)}`);
  } else {
    parts.push(`L ${n(x)} ${n(y + h)}`);
  }
  parts.push(`L ${n(x)} ${n(y + tl)}`);
  if (tl > 0) {
    parts.push(`A ${n(tl)} ${n(tl)} 0 0 1 ${n(x + tl)} ${n(y)}`);
  } else {
    parts.push(`L ${n(x)} ${n(y)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
