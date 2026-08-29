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
}): BlobLayout {
  const { cardGrowth, railLength, joinOffset } = input;
  const vertical = cardGrowth === "left" || cardGrowth === "right";
  const along = vertical ? HUD.cardHeight : HUD.cardWidth;
  const origin = cardOriginAlongRail(joinOffset, railLength, along);

  if (cardGrowth === "left") {
    return {
      width: HUD.cardWidth + HUD.joinWidth + HUD.railWidth,
      height: railLength,
      card: {
        x: 0,
        y: origin,
        width: HUD.cardWidth,
        height: HUD.cardHeight,
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
        height: HUD.cardHeight,
      },
      join: { x: HUD.railWidth, y: joinOffset },
    };
  }

  if (cardGrowth === "up") {
    return {
      width: railLength,
      height: HUD.cardHeight + HUD.joinWidth + HUD.railWidth,
      card: {
        x: origin,
        y: 0,
        width: HUD.cardWidth,
        height: HUD.cardHeight,
      },
      rail: {
        x: 0,
        y: HUD.cardHeight + HUD.joinWidth,
        width: railLength,
        height: HUD.railWidth,
      },
      join: { x: joinOffset, y: HUD.cardHeight + HUD.joinWidth },
    };
  }

  return {
    width: railLength,
    height: HUD.cardHeight + HUD.joinWidth + HUD.railWidth,
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
      height: HUD.cardHeight,
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
  if (biteRadius <= 0) {
    return roundedRectPath(rail, { tl: r, tr: r, br: r, bl: r });
  }
  return bittenRailPath(growth, rail, r, biteRadius, bite?.joinOffset ?? 0);
}

function bittenRailPath(
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
    const maxBite = Math.max(1, (h - corner * 2) / 2);
    const radius = Math.min(bite, maxBite);
    const cy = clamp(joinOffset, y + corner + radius, y + h - corner - radius);
    const into = growth === "left" ? 0 : 1;
    return [
      `M ${n(outerX)} ${n(y)}`,
      `L ${n(outerX)} ${n(y + h)}`,
      `L ${n(innerX + (growth === "left" ? corner : -corner))} ${n(y + h)}`,
      `A ${n(corner)} ${n(corner)} 0 0 ${growth === "left" ? 1 : 0} ${n(innerX)} ${n(y + h - corner)}`,
      `L ${n(innerX)} ${n(cy + radius)}`,
      `A ${n(radius)} ${n(radius)} 0 0 ${into} ${n(innerX)} ${n(cy - radius)}`,
      `L ${n(innerX)} ${n(y + corner)}`,
      `A ${n(corner)} ${n(corner)} 0 0 ${growth === "left" ? 1 : 0} ${n(innerX + (growth === "left" ? corner : -corner))} ${n(y)}`,
      "Z",
    ].join(" ");
  }

  const innerY = growth === "up" ? y : y + h;
  const outerY = growth === "up" ? y + h : y;
  const maxBite = Math.max(1, (w - corner * 2) / 2);
  const radius = Math.min(bite, maxBite);
  const cx = clamp(joinOffset, x + corner + radius, x + w - corner - radius);
  const into = growth === "up" ? 0 : 1;
  return [
    `M ${n(x)} ${n(outerY)}`,
    `L ${n(x + w)} ${n(outerY)}`,
    `L ${n(x + w)} ${n(innerY + (growth === "up" ? -corner : corner))}`,
    `A ${n(corner)} ${n(corner)} 0 0 ${growth === "up" ? 1 : 0} ${n(x + w - corner)} ${n(innerY)}`,
    `L ${n(cx + radius)} ${n(innerY)}`,
    `A ${n(radius)} ${n(radius)} 0 0 ${into} ${n(cx - radius)} ${n(innerY)}`,
    `L ${n(x + corner)} ${n(innerY)}`,
    `A ${n(corner)} ${n(corner)} 0 0 ${growth === "up" ? 1 : 0} ${n(x)} ${n(innerY + (growth === "up" ? -corner : corner))}`,
    "Z",
  ].join(" ");
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
    const baseX = fromRight ? card.x + card.width : card.x;
    const tipX = fromRight ? rail.x + overlap : rail.x + rail.width - overlap;
    const minY = card.y + HUD.cardRadius;
    const maxY = card.y + card.height - HUD.cardRadius;
    const top = clamp(joinOffset - half, minY, maxY);
    const bot = clamp(joinOffset + half, minY, maxY);
    const tipY = clamp(joinOffset, minY, maxY);
    const out = fromRight ? 1 : -1;
    const reach = Math.abs(tipX - baseX);
    const ctrlX = reach * 0.55;
    return [
      `M ${n(baseX)} ${n(top)}`,
      `C ${n(baseX + out * ctrlX)} ${n(top + ctrl)}, ${n(tipX)} ${n(tipY - 1)}, ${n(tipX)} ${n(tipY)}`,
      `C ${n(tipX)} ${n(tipY + 1)}, ${n(baseX + out * ctrlX)} ${n(bot - ctrl)}, ${n(baseX)} ${n(bot)}`,
      "Z",
    ].join(" ");
  }

  const fromBottom = growth === "up";
  const baseY = fromBottom ? card.y + card.height : card.y;
  const tipY = fromBottom ? rail.y + overlap : rail.y + rail.height - overlap;
  const minX = card.x + HUD.cardRadius;
  const maxX = card.x + card.width - HUD.cardRadius;
  const left = clamp(joinOffset - half, minX, maxX);
  const right = clamp(joinOffset + half, minX, maxX);
  const tipX = clamp(joinOffset, minX, maxX);
  const out = fromBottom ? 1 : -1;
  const reach = Math.abs(tipY - baseY);
  const ctrlY = reach * 0.55;
  return [
    `M ${n(left)} ${n(baseY)}`,
    `C ${n(left + ctrl)} ${n(baseY + out * ctrlY)}, ${n(tipX - 1)} ${n(tipY)}, ${n(tipX)} ${n(tipY)}`,
    `C ${n(tipX + 1)} ${n(tipY)}, ${n(right - ctrl)} ${n(baseY + out * ctrlY)}, ${n(right)} ${n(baseY)}`,
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
