import type { Rect, ScreenEdge } from "./placement.ts";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type { ScreenEdge };

/**
 * Distance from a point to each screen edge, expressed as a fraction of the
 * display so a wide screen does not make the top and bottom edges win by
 * default. The result partitions the screen into four diagonal wedges.
 */
export function edgeAffinity(
  point: { x: number; y: number },
  bounds: Rect,
): Record<ScreenEdge, number> {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  return {
    left: (point.x - bounds.x) / width,
    right: (bounds.x + bounds.width - point.x) / width,
    top: (point.y - bounds.y) / height,
    bottom: (bounds.y + bounds.height - point.y) / height,
  };
}

export function nearestEdgeForPoint(
  point: { x: number; y: number },
  bounds: Rect,
): ScreenEdge {
  const affinity = edgeAffinity(point, bounds);
  const entries = Object.entries(affinity) as Array<[ScreenEdge, number]>;
  entries.sort((left, right) => left[1] - right[1]);
  return entries[0]?.[0] ?? "right";
}

/**
 * Where the dock should sit while being dragged along `edge`. The axis pinned
 * to the edge is fixed by the placement; only the other one follows the cursor.
 */
export function slideAlongEdge(input: {
  slide: { axis: "x" | "y"; min: number; max: number };
  anchorX: number;
  anchorY: number;
  cursor: { x: number; y: number };
  grabOffset: number;
}): { x: number; y: number } {
  const along = clamp(
    (input.slide.axis === "x" ? input.cursor.x : input.cursor.y) -
      input.grabOffset,
    input.slide.min,
    input.slide.max,
  );
  if (input.slide.axis === "x") {
    return { x: Math.round(along), y: Math.round(input.anchorY) };
  }
  return { x: Math.round(input.anchorX), y: Math.round(along) };
}
