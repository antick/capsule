import { goldenSuite } from "@capsule/fixtures/vitest";
import {
  PLACEMENT,
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  type PlacementPreset,
} from "./constants.ts";
import {
  cardHeightFor,
  cardHeightForBuckets,
  cardMessageHeight,
  cardReserveHeight,
  clampHudScale,
  type HardwareNotch,
  hudMetrics,
  hudScaleRange,
  hudScaleSteps,
  joinedNotchRailLength,
  joinOffsetForIndex,
  meterBlockSize,
  meterStrideSize,
  nextHudScale,
  railEndSpread,
  railLengthForCount,
  sessionRowsShown,
  virtualNotch,
} from "./metrics.ts";
import {
  type ChromeSnapshot,
  computePlacement,
  dockAlongEdge,
  edgeForPreset,
  type HudSize,
  layoutForPreset,
  presetForEdge,
  type Rect,
  type SlideTrack,
  type WindowBox,
  zoomHoldBounds,
} from "./placement.ts";
import { nearestEdgeForPoint, slideAlongEdge } from "./snap.ts";

/**
 * Exact placement and sizing values, recorded from this implementation and
 * read by the Swift port. The inline tests beside this file assert the
 * properties those values must have; these hold the values themselves.
 */

goldenSuite(
  "placement/compute-placement",
  (input: {
    preset: PlacementPreset;
    chrome: ChromeSnapshot;
    hud: HudSize;
    notchAllowed: boolean;
  }) =>
    computePlacement(input.preset, input.chrome, input.hud, PLACEMENT, {
      notchAllowed: input.notchAllowed,
    }),
);

goldenSuite(
  "placement/dock-along-edge",
  (input: { track: SlideTrack; railStart: number }) =>
    dockAlongEdge(input.track, input.railStart),
);

goldenSuite("placement/slide-along-edge", slideAlongEdge);

goldenSuite(
  "placement/nearest-edge",
  (input: { point: { x: number; y: number }; bounds: Rect }) =>
    nearestEdgeForPoint(input.point, input.bounds),
);

goldenSuite(
  "placement/zoom-hold-bounds",
  (input: {
    target: WindowBox;
    current: WindowBox;
    cardGrowth: "left" | "right" | "up" | "down";
  }) => zoomHoldBounds(input.target, input.current, input.cardGrowth),
);

goldenSuite("placement/layout-for-preset", (preset: PlacementPreset) => {
  const edge = edgeForPreset(preset);
  return {
    edge,
    layout: layoutForPreset(preset),
    presetForEdge: presetForEdge(edge),
    label: PLACEMENT_LABELS[preset],
    hint: PLACEMENT_HINTS[preset],
  };
});

goldenSuite("hud-metrics/metrics", (scale: number) => hudMetrics(scale));

goldenSuite("hud-metrics/clamp-scale", (scale: number) => clampHudScale(scale));

goldenSuite("hud-metrics/scale-range", (scale: number) => hudScaleRange(scale));

goldenSuite(
  "hud-metrics/next-scale",
  (input: { scale: number; direction: 1 | -1 }) =>
    nextHudScale(input.scale, input.direction),
);

goldenSuite("hud-metrics/scale-steps", () => hudScaleSteps());

goldenSuite(
  "hud-metrics/rail-sizes",
  (input: { scale: number; compact: boolean; count: number }) => {
    const m = hudMetrics(input.scale);
    return {
      meterBlock: meterBlockSize(m, input.compact),
      meterStride: meterStrideSize(m, input.compact),
      railLength: railLengthForCount(m, input.count, input.compact),
      joinOffsets: Array.from({ length: Math.max(1, input.count) }, (_, i) =>
        joinOffsetForIndex(m, i, input.compact),
      ),
    };
  },
);

goldenSuite(
  "hud-metrics/card-height",
  (input: {
    scale: number;
    buckets?: number;
    sessions?: number;
    tokens?: boolean;
    named?: "reserve" | "message" | "buckets";
  }) => {
    const m = hudMetrics(input.scale);
    if (input.named === "reserve") return cardReserveHeight(m);
    if (input.named === "message") return cardMessageHeight(m);
    if (input.named === "buckets") {
      return cardHeightForBuckets(m, input.buckets ?? 0);
    }
    return cardHeightFor(m, {
      buckets: input.buckets ?? 0,
      sessions: input.sessions,
      tokens: input.tokens,
    });
  },
);

goldenSuite("hud-metrics/session-rows", (count: number) =>
  sessionRowsShown(count),
);

goldenSuite(
  "hud-metrics/notch",
  (input: {
    scale: number;
    kind: "virtual" | "joined" | "spread";
    menuBarHeight?: number;
    count?: number;
    compact?: boolean;
    railLength?: number | null;
    notch?: HardwareNotch;
  }) => {
    const m = hudMetrics(input.scale);
    if (input.kind === "virtual") {
      return virtualNotch(m, input.menuBarHeight ?? 0);
    }
    const count = input.count ?? 1;
    if (input.kind === "joined") {
      return joinedNotchRailLength(
        m,
        count,
        input.notch ?? { width: 0, height: 0 },
      );
    }
    const compact = input.compact ?? false;
    // A null length means "exactly what the meters need".
    const railLength =
      input.railLength ?? railLengthForCount(m, count, compact);
    return railEndSpread(m, count, compact, railLength);
  },
);
