import {
  type CapsuleSettings,
  type ChromeSnapshot,
  CORNER_ARC_ENABLED,
  type Corner,
  cardReserveHeight,
  computePlacement,
  cornerForRail,
  cornerWindowSize,
  dockEdgeGap,
  dockStyleFor,
  type HardwareNotch,
  hudMetrics,
  joinedNotchRailLength,
  PLACEMENT,
  type PlacementPreset,
  type PlacementResult,
  railLengthForCount,
  styleSupportsNotch,
  type WindowBox,
} from "@capsule/config";
import { type Display, screen } from "electron";

/**
 * Where the dock's window goes for the current settings, sized for the rail
 * the renderer will draw and the tallest card it might open.
 */
export function computeDockPlacement(input: {
  settings: CapsuleSettings;
  meterCount: number;
  /** The display's own notch, when the top edge is drawn as it. */
  hardwareNotch: HardwareNotch | null;
  preset: PlacementPreset;
  chrome: ChromeSnapshot;
  corner: Corner | null;
}): PlacementResult {
  const { settings, meterCount, preset, chrome, corner } = input;
  const metrics = hudMetrics(settings.hudScale);
  const style = dockStyleFor(settings.dockStyle);
  const notchAllowed = styleSupportsNotch(style);
  // Matches UsageDock: a dock lying along an edge drops its percent
  // captions, which makes its rail shorter than a vertical one. An arc drops
  // them too, so a corner dock measures as a compact one.
  const compact =
    corner !== null || preset === "top-edge" || preset === "bottom-edge";
  // Sized for the tallest card, since the window cannot resize itself
  // mid-animation without the bubble tearing.
  const cardHeight = cardReserveHeight(metrics);
  // Drawn as the display's notch the rail is deeper by the notch's height,
  // at least as wide as the hardware, and meets the frame with a small
  // fillet rather than a flare. Has to match what the renderer draws.
  const joined =
    preset === "top-edge" && corner === null && notchAllowed
      ? input.hardwareNotch
      : null;
  return computePlacement(
    preset,
    chrome,
    {
      railWidth: metrics.railWidth + (joined?.height ?? 0),
      railLength: joined
        ? joinedNotchRailLength(metrics, meterCount, joined)
        : railLengthForCount(metrics, meterCount, compact),
      cardWidth: metrics.cardWidth,
      cardHeight,
      expanded: true,
      shadowPadding: metrics.shadowPadding,
      joinWidth: metrics.tailLength + metrics.joinGap,
      edgeFlare: joined
        ? metrics.notchBezelFillet
        : metrics.edgeFlare * style.flare,
      edgeGap: dockEdgeGap(metrics, style),
      corner: cornerWindowSize(metrics, { meterCount, cardHeight, style }),
    },
    PLACEMENT,
    { notchAllowed, corner },
  );
}

/** Auto-hide folds the corner band down without changing its placement. */
export function curlsIntoCorners(settings: CapsuleSettings): boolean {
  return CORNER_ARC_ENABLED && settings.cornerArc;
}

/** Recover a parked corner on startup or an explicit off-to-on change. */
export function settingsForCornerToggle(
  previous: CapsuleSettings | null,
  next: CapsuleSettings,
  meterCount: number,
  chrome: ChromeSnapshot,
): CapsuleSettings {
  if (!CORNER_ARC_ENABLED)
    return { ...next, cornerArc: false, customCorner: null };
  if (
    previous?.cornerArc ||
    !next.cornerArc ||
    !next.customPosition ||
    next.customCorner
  )
    return next;
  const placement = computeDockPlacement({
    settings: next,
    meterCount,
    chrome,
    preset: next.placementPreset,
    hardwareNotch: null,
    corner: null,
  });
  const railStart =
    placement.slide.axis === "x"
      ? next.customPosition.x
      : next.customPosition.y;
  return {
    ...next,
    customCorner: cornerForPlacement(next, placement, railStart),
  };
}

/** The corner a rail dragged to `railStart` has reached, if it may curl. */
export function cornerForPlacement(
  settings: CapsuleSettings,
  placement: PlacementResult,
  railStart: number,
): Corner | null {
  if (!curlsIntoCorners(settings)) {
    return null;
  }
  return cornerForRail(
    placement.edge,
    placement.slide,
    railStart,
    PLACEMENT.cornerSnapPx,
  );
}

/** Where the rail's leading edge sits, given a placement's own window. */
export function railStartOf(placement: PlacementResult): number {
  const axis = placement.slide.axis === "x" ? placement.x : placement.y;
  return axis + placement.slide.gutter + placement.railBias;
}

/** A placement's window, in the whole pixels a window can actually have. */
export function windowBoxOf(placement: PlacementResult): WindowBox {
  return {
    x: Math.round(placement.x),
    y: Math.round(placement.y),
    width: Math.round(placement.width),
    height: Math.round(placement.height),
  };
}

/** The display the dock was last placed on, or the primary one if it has gone. */
export function displayFor(displayId: number | null): Display {
  return (
    screen.getAllDisplays().find((item) => item.id === displayId) ??
    screen.getPrimaryDisplay()
  );
}

/** The three facts about a display the placement engine reads. */
export function describeDisplay(display: Display): ChromeSnapshot["display"] {
  return { id: display.id, bounds: display.bounds, workArea: display.workArea };
}

/**
 * The display the dock lives on, without asking the system Dock. Dock metrics
 * only matter for the bottom preset, and the work-area inset already tells us
 * the Dock's thickness during a drag.
 */
export function syntheticChromeFor(display: Display): ChromeSnapshot {
  return {
    display: describeDisplay(display),
    dock: { orientation: "bottom", autohide: false, tilesize: 48 },
  };
}
