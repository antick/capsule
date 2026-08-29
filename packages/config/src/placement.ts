import { PLACEMENT, type PlacementPreset } from "./constants.ts";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DockOrientation = "bottom" | "left" | "right";

export interface ChromeSnapshot {
  display: {
    id: number;
    bounds: Rect;
    workArea: Rect;
  };
  dock: {
    orientation: DockOrientation;
    autohide: boolean;
    tilesize: number;
  };
}

export interface HudSize {
  railWidth: number;
  railLength: number;
  cardWidth: number;
  cardHeight: number;
  expanded: boolean;
  shadowPadding: number;
  joinWidth: number;
  edgeFlare: number;
}

export type ScreenEdge = "left" | "right" | "top" | "bottom";

export interface PlacementResult {
  displayId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: "vertical" | "horizontal";
  cardGrowth: "left" | "right" | "up" | "down";
  edge: ScreenEdge;
  visualPreset: PlacementPreset;
  /** True when the dock should render as a screen-top notch. */
  notch: boolean;
  /** Range the dock may slide along its edge, in screen coordinates. */
  slide: { axis: "x" | "y"; min: number; max: number };
}

export function edgeForPreset(preset: PlacementPreset): ScreenEdge {
  if (preset === "left-edge") {
    return "left";
  }
  if (preset === "top-edge") {
    return "top";
  }
  if (preset === "bottom-edge") {
    return "bottom";
  }
  return "right";
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

export function layoutForPreset(preset: PlacementPreset): {
  orientation: "vertical" | "horizontal";
  cardGrowth: "left" | "right" | "up" | "down";
  notch: boolean;
} {
  if (preset === "left-edge") {
    return { orientation: "vertical", cardGrowth: "right", notch: false };
  }
  if (preset === "top-edge") {
    return { orientation: "horizontal", cardGrowth: "down", notch: true };
  }
  if (preset === "bottom-edge") {
    return { orientation: "horizontal", cardGrowth: "up", notch: false };
  }
  return { orientation: "vertical", cardGrowth: "left", notch: false };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extent along the rail. A short rail with a tall card still has to fit the
 * card, or the bubble is clipped by the window it lives in.
 */
function alongSize(hud: HudSize, cardAlong: number): number {
  const rail = hud.railLength + hud.edgeFlare * 2;
  return Math.max(rail, hud.expanded ? cardAlong : 0) + hud.shadowPadding * 2;
}

function verticalWindowSize(hud: HudSize): { width: number; height: number } {
  const extra = hud.expanded ? hud.cardWidth + hud.joinWidth : 0;
  return {
    width: hud.railWidth + extra + hud.shadowPadding,
    height: alongSize(hud, hud.cardHeight),
  };
}

function horizontalWindowSize(hud: HudSize): { width: number; height: number } {
  const extra = hud.expanded ? hud.cardHeight + hud.joinWidth : 0;
  return {
    width: alongSize(hud, hud.cardWidth),
    height: hud.railWidth + extra + hud.shadowPadding,
  };
}

function centerInRange(start: number, span: number, size: number): number {
  return Math.round(start + (span - size) / 2);
}

/**
 * How tall the Dock is on this display. macOS shrinks the work area by exactly
 * that much, so the difference tells us without reading private preferences.
 */
function dockThickness(chrome: ChromeSnapshot): number {
  const { bounds, workArea } = chrome.display;
  if (chrome.dock.orientation !== "bottom") {
    return 0;
  }
  return Math.max(0, bounds.y + bounds.height - (workArea.y + workArea.height));
}

export function computePlacement(
  preset: PlacementPreset,
  chrome: ChromeSnapshot,
  hud: HudSize,
  constants: typeof PLACEMENT = PLACEMENT,
): PlacementResult {
  const { bounds, workArea, id } = chrome.display;
  const { orientation, cardGrowth, notch } = layoutForPreset(preset);
  const edge = edgeForPreset(preset);

  if (edge === "right" || edge === "left") {
    const size = verticalWindowSize(hud);
    // Vertical docks stay inside the work area so they never cover the menu bar.
    const min = workArea.y;
    const max = Math.max(min, workArea.y + workArea.height - size.height);
    return {
      displayId: id,
      x: edge === "right" ? bounds.x + bounds.width - size.width : bounds.x,
      y: clamp(
        centerInRange(workArea.y, workArea.height, size.height),
        min,
        max,
      ),
      ...size,
      orientation,
      cardGrowth,
      edge,
      visualPreset: preset,
      notch,
      slide: { axis: "y", min, max },
    };
  }

  const size = horizontalWindowSize(hud);
  const min = bounds.x + (notch ? constants.notchSideInsetPx : 0);
  const max = Math.max(
    min,
    bounds.x +
      bounds.width -
      size.width -
      (notch ? constants.notchSideInsetPx : 0),
  );

  if (edge === "top") {
    // The notch hangs from the physical top of the screen, over the menu bar.
    return {
      displayId: id,
      x: clamp(centerInRange(bounds.x, bounds.width, size.width), min, max),
      y: bounds.y,
      ...size,
      orientation,
      cardGrowth,
      edge,
      visualPreset: preset,
      notch,
      slide: { axis: "x", min, max },
    };
  }

  // Bottom: ride the physical screen bottom so the HUD is level with the Dock
  // rather than floating above it, then default to the free space beside it.
  const dock = dockThickness(chrome);
  const y =
    dock > 0
      ? bounds.y + bounds.height - Math.max(size.height, dock)
      : bounds.y + bounds.height - size.height;
  const dockSpan = constants.dockCenteredIconSpanPx;
  const dockLeft = centerInRange(bounds.x, bounds.width, dockSpan);
  const besideDock =
    dockLeft - constants.dockFlankMarginPx - size.width >= bounds.x
      ? dockLeft - constants.dockFlankMarginPx - size.width
      : dockLeft + dockSpan + constants.dockFlankMarginPx;

  return {
    displayId: id,
    x: clamp(besideDock, min, max),
    y: Math.round(y),
    ...size,
    orientation,
    cardGrowth,
    edge,
    visualPreset: preset,
    notch,
    slide: { axis: "x", min, max },
  };
}
