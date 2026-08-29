import {
  cardHeightForBuckets,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  type DockStyleId,
  dockStyleFor,
  type HudThemeSetting,
  hudMetrics,
  joinOffsetForIndex,
  layoutForPreset,
  type PlacementPreset,
  railLengthForCount,
  resolveHudTheme,
  styleSupportsNotch,
  type UsageSnapshot,
} from "@capsule/config";
import { blobLayout, UsageDock } from "@capsule/hud";
import { cn } from "@capsule/ui";
import { type ReactElement, useLayoutEffect, useRef, useState } from "react";

const BOX_HEIGHT = 280;
const INSET = 16;

/** Which side of the preview the dock hugs, so it reads as a screen edge. */
const EDGE_FIT: Record<PlacementPreset, { align: string; origin: string }> = {
  "right-edge": { align: "justify-end items-center", origin: "right center" },
  "left-edge": { align: "justify-start items-center", origin: "left center" },
  "top-edge": { align: "justify-center items-start", origin: "center top" },
  "bottom-edge": {
    align: "justify-center items-end",
    origin: "center bottom",
  },
};

/**
 * The real dock, pinned to the edge it will occupy and shrunk to fit the panel.
 * Reusing the HUD itself means the preview cannot drift from the thing it is
 * previewing.
 */
export function DockPreview({
  preset,
  scale,
  themeSetting,
  styleId,
  snapshots,
}: {
  preset: PlacementPreset;
  scale: number;
  themeSetting: HudThemeSetting;
  styleId: DockStyleId;
  snapshots: UsageSnapshot[];
}): ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setBoxWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const metrics = hudMetrics(scale);
  const layout = layoutForPreset(preset);
  const dockStyle = dockStyleFor(styleId);
  // The preview panel is dark, so `auto` shows the palette it would pick there.
  const theme = resolveHudTheme(themeSetting, "dark");
  const fit = EDGE_FIT[preset];
  const meters = snapshots.length > 0 ? snapshots : DEMO_SNAPSHOTS;
  const compact = layout.orientation === "horizontal";
  const frame = blobLayout(metrics, {
    cardGrowth: layout.cardGrowth,
    railLength: railLengthForCount(metrics, meters.length, compact),
    joinOffset: joinOffsetForIndex(metrics, 0, compact),
    cardHeight: cardHeightForBuckets(metrics, 2),
  });
  const pad = metrics.shadowPadding * 2;
  const zoom = Math.min(
    1,
    (BOX_HEIGHT - INSET) / (frame.height + pad),
    boxWidth > 0 ? (boxWidth - INSET) / (frame.width + pad) : 1,
  );

  return (
    <div
      ref={box}
      className={cn(
        "flex overflow-hidden rounded-xl border border-shell-line bg-[radial-gradient(circle_at_50%_0%,#26262f,#0f0f13)]",
        fit.align,
      )}
      style={{ height: BOX_HEIGHT }}
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: fit.origin,
          pointerEvents: "none",
        }}
      >
        <UsageDock
          snapshots={meters}
          metrics={metrics}
          theme={theme}
          dockStyle={dockStyle}
          orientation={layout.orientation}
          cardGrowth={layout.cardGrowth}
          notch={layout.notch && styleSupportsNotch(dockStyle)}
          now={new Date(DEMO_NOW_ISO)}
          forceOpenProviderId={meters[0]?.providerId ?? null}
        />
      </div>
    </div>
  );
}
