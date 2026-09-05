export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CardGrowth = "left" | "right" | "up" | "down";

export function n(value: number): string {
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

export function mapperFor(growth: CardGrowth, canonicalWidth: number): Mapper {
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

export function mapRect(
  rect: Rect,
  growth: CardGrowth,
  canonicalWidth: number,
): Rect {
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
