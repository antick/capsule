import {
  type Corner,
  cardHeightForBuckets,
  cardReserveHeight,
  DOCK_STYLES,
  type DockStyle,
  HUD,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
} from "@capsule/config";
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
} from "react";
import type { HitRegions } from "./blob-path.ts";
import { cornerLayout } from "./corner-path.ts";
import { cardReveal } from "./reveal.ts";
import { dockShadow } from "./shadow.ts";

/**
 * The dock curled into a screen corner: a quarter-ring bridging the two edges
 * with the meters spread along it, and the card hanging off the active meter
 * on the same radius. Shares the edge dock's rule that the card and the rail
 * are one surface — the spur runs back into the band.
 */
export function CornerFrame({
  metrics,
  theme = HUD_THEMES.midnight,
  style = DOCK_STYLES.rail,
  corner,
  open,
  dragging,
  activeIndex,
  cardHeight,
  meters,
  card,
  onHitRegions,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  style?: DockStyle;
  corner: Corner;
  open: boolean;
  dragging: boolean;
  activeIndex: number;
  cardHeight?: number;
  /** One node per meter, positioned on the arc rather than stacked. */
  meters: ReactNode[];
  card: ReactNode;
  onHitRegions?: (regions: HitRegions) => void;
}): ReactElement {
  const height = cardHeight ?? cardHeightForBuckets(metrics, 2);
  const layout = cornerLayout(metrics, {
    corner,
    meterCount: meters.length,
    cardHeight: height,
    cardReserve: cardReserveHeight(metrics),
    activeIndex,
    style,
  });
  const visible = open && !dragging;
  const shadow = dockShadow(metrics, theme);
  const pad = layout.padding;
  const reveal = cardReveal(visible);

  const hitKey = JSON.stringify(regionsFor(layout, pad, visible));
  useEffect(() => {
    onHitRegions?.(JSON.parse(hitKey) as HitRegions);
  }, [hitKey, onHitRegions]);

  return (
    <div
      data-hud-frame="true"
      data-hud-corner={corner}
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: layout.width + pad.left + pad.right,
        height: layout.height + pad.top + pad.bottom,
        paddingTop: pad.top,
        paddingRight: pad.right,
        paddingBottom: pad.bottom,
        paddingLeft: pad.left,
        fontFamily: HUD.fontFamily,
        color: theme.text,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: layout.width,
          height: layout.height,
        }}
      >
        <div
          data-hud-silhouette="true"
          style={{
            position: "absolute",
            inset: 0,
            filter: shadow,
            pointerEvents: "none",
          }}
        >
          <svg
            data-hud-rail-shape="true"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <path
              d={layout.arc}
              fill={theme.surface}
              data-hud-hit="true"
              style={{
                pointerEvents: "fill",
                cursor: dragging ? "grabbing" : "grab",
              }}
            />
            {style.outline ? (
              <path
                d={layout.arc}
                fill="none"
                stroke={theme.surfaceEdge}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
            ) : null}
          </svg>

          <svg
            data-hud-bubble="true"
            data-card-open={open ? "true" : "false"}
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              pointerEvents: "none",
              transformOrigin: `${layout.tip.x}px ${layout.tip.y}px`,
              ...reveal,
            }}
          >
            <path
              d={layout.bubble}
              fill={theme.surface}
              data-hud-hit={visible ? "true" : undefined}
              style={{ pointerEvents: visible ? "fill" : "none" }}
            />
            {style.outline ? (
              <path
                d={layout.bubble}
                fill="none"
                stroke={theme.surfaceEdge}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
            ) : null}
          </svg>
        </div>

        <div
          data-card-wrap="true"
          data-hud-hit={visible ? "true" : undefined}
          style={{
            position: "absolute",
            left: layout.card.x,
            top: layout.card.y,
            width: layout.card.width,
            height: layout.card.height,
            boxSizing: "border-box",
            transformOrigin: `${layout.tip.x - layout.card.x}px ${
              layout.tip.y - layout.card.y
            }px`,
            pointerEvents: visible ? "auto" : "none",
            ...reveal,
          }}
        >
          {card}
        </div>

        {meters.map((meter, index) => {
          const centre = layout.meters[index];
          return (
            <div
              key={keyOf(meter, index)}
              data-hud-rail="true"
              style={{
                position: "absolute",
                left: (centre?.x ?? 0) - metrics.meterSize / 2,
                top: (centre?.y ?? 0) - metrics.meterSize / 2,
                width: metrics.meterSize,
                height: metrics.meterSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                cursor: dragging ? "grabbing" : "grab",
              }}
            >
              {meter}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Each meter carries its provider key already; the wrapper reuses it. */
function keyOf(meter: ReactNode, index: number): string {
  const key = isValidElement(meter) ? meter.key : null;
  return key ?? `meter-${index}`;
}

function regionsFor(
  layout: ReturnType<typeof cornerLayout>,
  padding: { top: number; left: number },
  open: boolean,
): HitRegions {
  const shift = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ({
    x: rect.x + padding.left,
    y: rect.y + padding.top,
    width: rect.width,
    height: rect.height,
  });
  const rail = layout.hits.map(shift);
  if (!open) {
    return { rail, open: null };
  }
  const card = shift(layout.card);
  // The pointer has to cross the spur to reach the card, so the whole span
  // between the two has to stay live or the card closes on the way over.
  const spread = rail.reduce((acc, rect) => union(acc, rect), rail[0] ?? card);
  return { rail, open: union(spread, card) };
}

function union<
  T extends { x: number; y: number; width: number; height: number },
>(a: T, b: T): T {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    ...a,
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
