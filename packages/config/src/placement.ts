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
  /** Gap the dock style leaves between itself and the screen edge. */
  edgeGap: number;
}

export type ScreenEdge = "left" | "right" | "top" | "bottom";

/**
 * How far the dock may travel along its edge, and how its window relates to
 * the rail the user actually sees.
 *
 * The window is bigger than the rail in both directions: a transparent gutter
 * for the drop shadow, plus however much the card is longer than the rail,
 * since the window has to be able to show a card without resizing. Clamping
 * the window to the screen would therefore stop the rail well short of the
 * corners — the dead space the user sees as a gap. So travel is measured in
 * rail coordinates, and {@link dockAlongEdge} works out where to put the
 * window, and how far to slide the rail within it, for a given rail position.
 */
export interface SlideTrack {
  axis: "x" | "y";
  /** Range for the leading edge of the painted rail, in screen coordinates. */
  min: number;
  max: number;
  /** Length of the painted rail along this axis, flares included. */
  railLength: number;
  /** Transparent shadow gutter between the window and the frame inside it. */
  gutter: number;
  /** Spare frame the rail can slide within: the card's overhang, both ends. */
  slack: number;
  /** Window positions that keep the whole frame — and so the card — on screen. */
  windowMin: number;
  windowMax: number;
}

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
  slide: SlideTrack;
  /** Where the rail sits inside its frame, given `x`/`y`. */
  railBias: number;
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

interface AlongExtents {
  /** The painted rail, flares included: the part the user sees and drags. */
  rail: number;
  /** The frame drawn inside the window, stretched to fit the card. */
  frame: number;
  /** The frame plus its shadow gutter at each end. */
  window: number;
}

/**
 * Extents along the rail. A short rail with a long card still has to fit the
 * card, or the bubble is clipped by the window it lives in.
 */
function alongExtents(hud: HudSize, cardAlong: number): AlongExtents {
  const rail = hud.railLength + hud.edgeFlare * 2;
  const frame = Math.max(rail, hud.expanded ? cardAlong : 0);
  return { rail, frame, window: frame + hud.shadowPadding * 2 };
}

function verticalWindowSize(hud: HudSize): { width: number; height: number } {
  const extra = hud.expanded ? hud.cardWidth + hud.joinWidth : 0;
  return {
    width: hud.railWidth + extra + hud.shadowPadding + hud.edgeGap,
    height: alongExtents(hud, hud.cardHeight).window,
  };
}

function horizontalWindowSize(hud: HudSize): { width: number; height: number } {
  const extra = hud.expanded ? hud.cardHeight + hud.joinWidth : 0;
  return {
    width: alongExtents(hud, hud.cardWidth).window,
    height: hud.railWidth + extra + hud.shadowPadding + hud.edgeGap,
  };
}

function trackFor(input: {
  axis: "x" | "y";
  hud: HudSize;
  extents: AlongExtents;
  /** Physical screen span the rail may cover, inset for any notch margin. */
  start: number;
  end: number;
}): SlideTrack {
  const { extents, start, end } = input;
  const max = Math.max(start, end - extents.rail);
  const windowMin = start - input.hud.shadowPadding;
  return {
    axis: input.axis,
    min: start,
    max,
    railLength: extents.rail,
    gutter: input.hud.shadowPadding,
    slack: extents.frame - extents.rail,
    windowMin,
    // Only the gutter is allowed off screen; it is transparent, and keeping
    // the frame inside is what stops an open card from being cut off.
    windowMax: Math.max(
      windowMin,
      end - extents.window + input.hud.shadowPadding,
    ),
  };
}

/**
 * Places the window for a wanted rail position. The rail is centred in its
 * frame until that would push the frame off screen, at which point the window
 * stops and the rail keeps going, sliding across the slack instead.
 */
export function dockAlongEdge(
  track: SlideTrack,
  railStart: number,
): { window: number; railBias: number } {
  const rail = clamp(railStart, track.min, track.max);
  const centred = rail - track.gutter - track.slack / 2;
  const window = clamp(centred, track.windowMin, track.windowMax);
  return {
    window: Math.round(window),
    railBias: clamp(
      Math.round(rail - window - track.gutter),
      0,
      Math.round(track.slack),
    ),
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
  /** Dock styles that visibly float cannot pass for a notch. */
  options: { notchAllowed?: boolean } = {},
): PlacementResult {
  const { bounds, workArea, id } = chrome.display;
  const layout = layoutForPreset(preset);
  const { orientation, cardGrowth } = layout;
  const notch = layout.notch && options.notchAllowed !== false;
  const edge = edgeForPreset(preset);

  if (edge === "right" || edge === "left") {
    const size = verticalWindowSize(hud);
    // The rail rides the physical edge for its whole length: stopping at the
    // work area would leave it hanging above the Dock with a band of desktop
    // underneath, which is the gap that reads as broken.
    const extents = alongExtents(hud, hud.cardHeight);
    const track = trackFor({
      axis: "y",
      hud,
      extents,
      start: bounds.y,
      end: bounds.y + bounds.height,
    });
    // Centre on the usable height rather than the physical one, so the default
    // position is not pushed down by the menu bar.
    const placed = dockAlongEdge(
      track,
      centerInRange(workArea.y, workArea.height, extents.rail),
    );
    return {
      displayId: id,
      x: edge === "right" ? bounds.x + bounds.width - size.width : bounds.x,
      y: placed.window,
      ...size,
      orientation,
      cardGrowth,
      edge,
      visualPreset: preset,
      notch,
      slide: track,
      railBias: placed.railBias,
    };
  }

  const size = horizontalWindowSize(hud);
  const inset = notch ? constants.notchSideInsetPx : 0;
  const extents = alongExtents(hud, hud.cardWidth);
  const track = trackFor({
    axis: "x",
    hud,
    extents,
    start: bounds.x + inset,
    end: bounds.x + bounds.width - inset,
  });

  if (edge === "top") {
    // The dock hangs from the physical top of the screen, over the menu bar,
    // whichever style it is drawn in; a floating style keeps its own small gap.
    const placed = dockAlongEdge(
      track,
      centerInRange(bounds.x, bounds.width, extents.rail),
    );
    return {
      displayId: id,
      x: placed.window,
      y: bounds.y,
      ...size,
      orientation,
      cardGrowth,
      edge,
      visualPreset: preset,
      notch,
      slide: track,
      railBias: placed.railBias,
    };
  }

  // Bottom: sit on the physical screen bottom, the same edge the Dock sits on,
  // then default to the free space beside it.
  const centred = centerInRange(bounds.x, bounds.width, extents.rail);
  // Only a visible bottom Dock is in the way; a side or hidden one leaves the
  // whole edge free, so the HUD may as well sit in the middle of it.
  const sharesTheEdge =
    chrome.dock.orientation === "bottom" && !chrome.dock.autohide;
  const besideDock = () => {
    const span = constants.dockCenteredIconSpanPx;
    const left = centerInRange(bounds.x, bounds.width, span);
    const toTheLeft = left - constants.dockFlankMarginPx - extents.rail;
    return toTheLeft >= bounds.x
      ? toTheLeft
      : left + span + constants.dockFlankMarginPx;
  };
  const placed = dockAlongEdge(track, sharesTheEdge ? besideDock() : centred);

  return {
    displayId: id,
    x: placed.window,
    y: Math.round(bounds.y + bounds.height - size.height),
    ...size,
    orientation,
    cardGrowth,
    edge,
    visualPreset: preset,
    notch,
    slide: track,
    railBias: placed.railBias,
  };
}
