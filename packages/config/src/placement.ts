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
  stageManagerEnabled: boolean;
}

export interface HudSize {
  railWidth: number;
  railLength: number;
  cardWidth: number;
  cardHeight: number;
  expanded: boolean;
  shadowPadding: number;
}

export interface PlacementResult {
  displayId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: "vertical" | "horizontal";
  cardGrowth: "left" | "right" | "up" | "down";
  edge: "right" | "left" | "bottom" | "top";
  visualPreset: PlacementPreset;
}

export function layoutForPreset(preset: PlacementPreset): {
  orientation: "vertical" | "horizontal";
  cardGrowth: "left" | "right" | "up" | "down";
} {
  if (preset === "left-edge" || preset.startsWith("stage-manager")) {
    return { orientation: "vertical", cardGrowth: "right" };
  }
  if (preset === "top-edge") {
    return { orientation: "horizontal", cardGrowth: "down" };
  }
  if (preset === "bottom-edge" || preset.startsWith("dock-flank")) {
    return { orientation: "horizontal", cardGrowth: "up" };
  }
  return { orientation: "vertical", cardGrowth: "left" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function verticalWindowSize(hud: HudSize): { width: number; height: number } {
  const card = hud.expanded ? hud.cardWidth : 0;
  return {
    width: hud.railWidth + card + hud.shadowPadding,
    height: hud.railLength + hud.shadowPadding * 2,
  };
}

function horizontalWindowSize(hud: HudSize): { width: number; height: number } {
  const card = hud.expanded ? hud.cardHeight : 0;
  return {
    width: hud.railLength + hud.shadowPadding * 2,
    height: hud.railWidth + card + hud.shadowPadding,
  };
}

function centerInRange(start: number, span: number, size: number): number {
  return Math.round(start + (span - size) / 2);
}

export function computePlacement(
  preset: PlacementPreset,
  chrome: ChromeSnapshot,
  hud: HudSize,
  constants: typeof PLACEMENT = PLACEMENT,
): PlacementResult {
  const visualPreset =
    (preset === "stage-manager-top" || preset === "stage-manager-bottom") &&
    !chrome.stageManagerEnabled
      ? "left-edge"
      : preset;

  const { bounds, workArea, id } = chrome.display;

  if (visualPreset === "right-edge") {
    const size = verticalWindowSize(hud);
    const y = clamp(
      centerInRange(workArea.y, workArea.height, size.height),
      workArea.y,
      workArea.y + workArea.height - size.height,
    );
    return {
      displayId: id,
      x: bounds.x + bounds.width - size.width,
      y,
      ...size,
      orientation: "vertical",
      cardGrowth: "left",
      edge: "right",
      visualPreset,
    };
  }

  if (visualPreset === "top-edge") {
    const size = horizontalWindowSize(hud);
    const x = clamp(
      centerInRange(workArea.x, workArea.width, size.width),
      workArea.x,
      workArea.x + workArea.width - size.width,
    );
    return {
      displayId: id,
      x,
      y: workArea.y,
      ...size,
      orientation: "horizontal",
      cardGrowth: "down",
      edge: "top",
      visualPreset,
    };
  }

  if (visualPreset === "bottom-edge") {
    const size = horizontalWindowSize(hud);
    const x = clamp(
      centerInRange(workArea.x, workArea.width, size.width),
      workArea.x,
      workArea.x + workArea.width - size.width,
    );
    return {
      displayId: id,
      x,
      y: workArea.y + workArea.height - size.height,
      ...size,
      orientation: "horizontal",
      cardGrowth: "up",
      edge: "bottom",
      visualPreset,
    };
  }

  if (visualPreset === "left-edge") {
    const size = verticalWindowSize(hud);
    const y = clamp(
      centerInRange(workArea.y, workArea.height, size.height),
      workArea.y,
      workArea.y + workArea.height - size.height,
    );
    return {
      displayId: id,
      x: bounds.x,
      y,
      ...size,
      orientation: "vertical",
      cardGrowth: "right",
      edge: "left",
      visualPreset,
    };
  }

  if (
    visualPreset === "stage-manager-top" ||
    visualPreset === "stage-manager-bottom"
  ) {
    const size = verticalWindowSize(hud);
    const strip = constants.stageManagerStripWidthPx;
    const x = workArea.x + Math.max(0, (strip - size.width) / 2);
    const topY = workArea.y + constants.stageManagerThumbStackInsetPx;
    const bottomY =
      workArea.y +
      workArea.height -
      size.height -
      constants.stageManagerThumbStackInsetPx;
    const y = visualPreset === "stage-manager-top" ? topY : bottomY;
    return {
      displayId: id,
      x: Math.round(x),
      y: Math.round(y),
      ...size,
      orientation: "vertical",
      cardGrowth: "right",
      edge: "left",
      visualPreset,
    };
  }

  const size = horizontalWindowSize(hud);
  const dockSpan = constants.dockCenteredIconSpanPx;
  const bottomY =
    workArea.y + workArea.height - size.height - constants.dockFlankMarginPx;
  const leftX = workArea.x + constants.dockFlankMarginPx;
  const rightX =
    workArea.x + workArea.width - size.width - constants.dockFlankMarginPx;
  const centeredStart = centerInRange(workArea.x, workArea.width, dockSpan);

  if (
    chrome.dock.orientation === "left" ||
    chrome.dock.orientation === "right"
  ) {
    const verticalSize = verticalWindowSize(hud);
    const y = clamp(
      centerInRange(workArea.y, workArea.height, verticalSize.height),
      workArea.y,
      workArea.y + workArea.height - verticalSize.height,
    );
    const x =
      chrome.dock.orientation === "left"
        ? workArea.x + constants.dockFlankMarginPx
        : workArea.x +
          workArea.width -
          verticalSize.width -
          constants.dockFlankMarginPx;
    return {
      displayId: id,
      x: Math.round(x),
      y,
      ...verticalSize,
      orientation: "vertical",
      cardGrowth: chrome.dock.orientation === "left" ? "right" : "left",
      edge: chrome.dock.orientation,
      visualPreset,
    };
  }

  const preferLeft = visualPreset === "dock-flank-left";
  const x = preferLeft
    ? Math.min(leftX, centeredStart - size.width - constants.dockFlankMarginPx)
    : Math.max(
        rightX,
        centeredStart + dockSpan + constants.dockFlankMarginPx - size.width,
      );

  return {
    displayId: id,
    x: Math.round(
      clamp(x, workArea.x, workArea.x + workArea.width - size.width),
    ),
    y: Math.round(bottomY),
    ...size,
    orientation: "horizontal",
    cardGrowth: "up",
    edge: "bottom",
    visualPreset,
  };
}
