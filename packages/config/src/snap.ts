import { MOTION, type PlacementPreset } from "./constants.ts";
import type { Rect } from "./placement.ts";

export type ScreenEdge = "left" | "right" | "top" | "bottom";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distancesToEdges(
  win: Rect,
  display: Rect,
): Record<ScreenEdge, number> {
  return {
    left: win.x - display.x,
    right: display.x + display.width - (win.x + win.width),
    top: win.y - display.y,
    bottom: display.y + display.height - (win.y + win.height),
  };
}

export function nearestEdge(win: Rect, display: Rect): ScreenEdge {
  const distances = distancesToEdges(win, display);
  const entries = Object.entries(distances) as Array<[ScreenEdge, number]>;
  entries.sort((left, right) => left[1] - right[1]);
  return entries[0]?.[0] ?? "right";
}

export function presetForEdge(edge: ScreenEdge): PlacementPreset {
  if (edge === "left") {
    return "left-edge";
  }
  if (edge === "top") {
    return "top-edge";
  }
  if (edge === "bottom") {
    return "bottom-edge";
  }
  return "right-edge";
}

export function snapAfterDrag(
  win: Rect,
  display: Rect,
  snapDistance: number = MOTION.snapDistancePx,
): {
  x: number;
  y: number;
  preset: PlacementPreset;
  snapped: boolean;
} {
  const distances = distancesToEdges(win, display);
  const edge = nearestEdge(win, display);
  const snapped = distances[edge] <= snapDistance;
  const maxX = display.x + display.width - win.width;
  const maxY = display.y + display.height - win.height;
  let x = clamp(win.x, display.x, maxX);
  let y = clamp(win.y, display.y, maxY);
  if (snapped) {
    if (edge === "right") {
      x = maxX;
    } else if (edge === "left") {
      x = display.x;
    } else if (edge === "top") {
      y = display.y;
    } else {
      y = maxY;
    }
  }
  return { x, y, preset: presetForEdge(edge), snapped };
}
