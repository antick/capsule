import {
  type CapsuleSettings,
  type ChromeSnapshot,
  type Corner,
  cardReserveHeight,
  computePlacement,
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
} from "@capsule/config";
import type { Display } from "electron";

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

/**
 * The display the dock lives on, without asking the system Dock. Dock metrics
 * only matter for the bottom preset, and the work-area inset already tells us
 * the Dock's thickness during a drag.
 */
export function syntheticChromeFor(display: Display): ChromeSnapshot {
  return {
    display: {
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
    },
    dock: { orientation: "bottom", autohide: false, tilesize: 48 },
  };
}
