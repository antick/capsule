import {
  DOCK_STYLE_IDS,
  DOCK_STYLES,
  type DockStyle,
  type DockStyleId,
  dockEdgeGap,
  HUD_SCALE,
  hudMetrics,
  joinOffsetForIndex,
  railLengthForCount,
} from "@capsule/config";
import { blobLayout, railPath } from "@capsule/hud";
import { cn } from "@capsule/ui";
import type { ReactElement } from "react";

const METRICS = hudMetrics(HUD_SCALE.min);
// Drawn lying along an edge, which is the shape of the tile it sits in.
const LAYOUT = blobLayout(METRICS, {
  cardGrowth: "up",
  railLength: railLengthForCount(METRICS, 3, true),
  joinOffset: joinOffsetForIndex(METRICS, 0, true),
});

/**
 * The rail's real silhouette resting on a sliver of screen edge, so the
 * fillets, the pill and the gap each style leaves are the actual shapes
 * rather than a hand-drawn approximation of them.
 */
function Silhouette({ style }: { style: DockStyle }): ReactElement {
  const gap = dockEdgeGap(METRICS, style);
  const headroom = METRICS.railWidth * 0.3;
  const top = LAYOUT.rail.y - headroom;
  const height = LAYOUT.rail.height + headroom + gap;
  return (
    <svg
      viewBox={`0 ${top} ${LAYOUT.width} ${height}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <path
        d={railPath(METRICS, "up", LAYOUT, { style })}
        fill="#08080a"
        stroke={style.outline ? "rgba(255,255,255,0.3)" : "none"}
        strokeWidth={style.outline ? 1 : 0}
      />
    </svg>
  );
}

export function StylePicker({
  value,
  onChange,
}: {
  value: DockStyleId;
  onChange: (style: DockStyleId) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DOCK_STYLE_IDS.map((id) => {
        const style = DOCK_STYLES[id];
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-shell-accent/60 bg-shell-accent/10"
                : "border-shell-line bg-shell-panel hover:bg-shell-raised",
            )}
          >
            <span className="relative block h-16 overflow-hidden rounded-md bg-gradient-to-br from-[#5c6b74] to-[#333a44]">
              <Silhouette style={style} />
            </span>
            <span className="mt-2.5 block text-sm font-medium">
              {style.label}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-shell-muted">
              {style.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
