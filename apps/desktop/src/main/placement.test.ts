import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cardHeightForBuckets,
  cardMessageHeight,
  computePlacement,
  DOCK_STYLES,
  type DockStyle,
  dockEdgeGap,
  HUD,
  HUD_SCALE,
  hudMetrics,
  joinOffsetForIndex,
  PLACEMENT,
  type PlacementPreset,
  railLengthForCount,
  styleSupportsNotch,
} from "@capsule/config";
import { blobLayout, framePadding } from "@capsule/hud";
import { describe, expect, it } from "vitest";

// A 14" MacBook Pro: notched display, menu bar at 38px, Dock at the bottom.
const chrome = {
  display: {
    id: 1,
    bounds: { x: 0, y: 0, width: 1512, height: 982 },
    workArea: { x: 0, y: 38, width: 1512, height: 870 },
  },
  dock: { orientation: "bottom" as const, autohide: false, tilesize: 48 },
};

const METERS = 3;

function isCompact(preset: PlacementPreset): boolean {
  return preset === "top-edge" || preset === "bottom-edge";
}

/** Mirrors OverlayController.computeFor: the window the dock is given. */
function place(
  preset: PlacementPreset,
  scale = HUD_SCALE.default,
  style: DockStyle = DOCK_STYLES.rail,
) {
  const m = hudMetrics(scale);
  const notchAllowed = styleSupportsNotch(style);
  return computePlacement(
    preset,
    chrome,
    {
      railWidth: m.railWidth,
      railLength: railLengthForCount(m, METERS, isCompact(preset)),
      cardWidth: m.cardWidth,
      cardHeight: cardHeightForBuckets(m, HUD.maxCardBuckets),
      expanded: true,
      shadowPadding: m.shadowPadding,
      joinWidth: m.tailLength + m.joinGap,
      edgeFlare: m.edgeFlare * style.flare,
      edgeGap: dockEdgeGap(m, style),
    },
    PLACEMENT,
    { notchAllowed },
  );
}

describe("desktop placement wiring", () => {
  it("keeps an expanded right-edge rail flush", () => {
    const result = place("right-edge");
    expect(result.x + result.width).toBe(1512);
    expect(result.cardGrowth).toBe("left");
  });

  it("hangs the notch over the menu bar", () => {
    const result = place("top-edge");
    expect(result.notch).toBe(true);
    expect(result.y).toBe(0);
  });

  it("drops the bottom dock into the Dock's band, clear of its icons", () => {
    const result = place("bottom-edge");
    // The work area stops at 908; the Dock owns everything below it.
    expect(result.y + result.height).toBeGreaterThan(908);
    expect(result.y + result.height).toBeLessThanOrEqual(982);
    const dockLeft = (1512 - PLACEMENT.dockCenteredIconSpanPx) / 2;
    expect(result.x + result.width).toBeLessThanOrEqual(dockLeft);
  });

  it("shrinks the window when the user turns the size down", () => {
    expect(place("right-edge", HUD_SCALE.min).width).toBeLessThan(
      place("right-edge", HUD_SCALE.max).width,
    );
  });

  it("keeps a floating style below the menu bar instead of over it", () => {
    const result = place("top-edge", HUD_SCALE.default, DOCK_STYLES.capsule);
    expect(result.notch).toBe(false);
    expect(result.y).toBe(chrome.display.workArea.y);
  });

  it("leaves the tray style a gap against the edge it rides", () => {
    const flush = place("right-edge");
    const tray = place("right-edge", HUD_SCALE.default, DOCK_STYLES.tray);
    expect(tray.width).toBeGreaterThan(flush.width);
    expect(tray.x + tray.width).toBe(1512);
  });
});

/**
 * The window is sized by the main process and the dock is drawn by the
 * renderer, from the same numbers but through different code. When the two
 * disagree the frame is pinned to the docked edge and the surplus hangs off
 * the far side, where the window clips it — which is how an open card came to
 * lose its left edge along the bottom of the screen.
 */
describe("window and frame agree", () => {
  const presets: PlacementPreset[] = [
    "right-edge",
    "left-edge",
    "top-edge",
    "bottom-edge",
  ];

  for (const preset of presets) {
    for (const style of Object.values(DOCK_STYLES)) {
      it(`fits every card in a ${style.id} dock on the ${preset}`, () => {
        const m = hudMetrics(HUD_SCALE.default);
        const compact = isCompact(preset);
        const window = place(preset, HUD_SCALE.default, style);
        const cards = [
          cardMessageHeight(m),
          ...Array.from({ length: HUD.maxCardBuckets }, (_, index) =>
            cardHeightForBuckets(m, index + 1),
          ),
        ];

        for (const cardHeight of cards) {
          for (let index = 0; index < METERS; index += 1) {
            const layout = blobLayout(m, {
              cardGrowth: window.cardGrowth,
              railLength: railLengthForCount(m, METERS, compact),
              joinOffset: joinOffsetForIndex(m, index, compact),
              cardHeight,
              cardReserve: cardHeightForBuckets(m, HUD.maxCardBuckets),
              style,
            });
            const pad = framePadding(m, window.cardGrowth, style);
            expect(layout.width + pad.left + pad.right).toBe(window.width);
            expect(layout.height + pad.top + pad.bottom).toBe(window.height);
          }
        }
      });
    }
  }
});

describe("app chrome assets", () => {
  it("includes tray and Dock icons", () => {
    const resources = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../resources",
    );
    expect(existsSync(join(resources, "trayTemplate.png"))).toBe(true);
    expect(existsSync(join(resources, "trayTemplate@2x.png"))).toBe(true);
    expect(existsSync(join(resources, "dock.png"))).toBe(true);
  });
});
