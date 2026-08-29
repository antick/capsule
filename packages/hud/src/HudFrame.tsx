import {
  cardHeightForBuckets,
  DOCK_STYLES,
  type DockStyle,
  HUD,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  MOTION,
} from "@capsule/config";
import { type ReactElement, type ReactNode, useEffect } from "react";
import {
  blobLayout,
  bubbleOrigin,
  bubblePath,
  type CardGrowth,
  framePadding,
  type HitRegions,
  hitRegions,
  railPath,
} from "./blob-path.ts";
import { useAnimatedNumber } from "./use-animated-number.ts";

export type { CardGrowth, HitRegions };

export function HudFrame({
  metrics,
  theme = HUD_THEMES.midnight,
  style = DOCK_STYLES.rail,
  orientation,
  cardGrowth,
  notch,
  compact,
  open,
  joinOffset,
  dragging,
  railLength,
  cardHeight,
  rail,
  card,
  onHitRegions,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  style?: DockStyle;
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  notch?: boolean;
  /** Horizontal docks drop the percent caption to stay edge-thin. */
  compact?: boolean;
  open: boolean;
  joinOffset: number;
  dragging: boolean;
  railLength: number;
  cardHeight?: number;
  rail: ReactNode;
  card: ReactNode;
  onHitRegions?: (regions: HitRegions) => void;
}): ReactElement {
  const height = cardHeight ?? cardHeightForBuckets(metrics, 2);
  // The tail slides between meters instead of jumping.
  const join = useAnimatedNumber(joinOffset, MOTION.slideMs);
  const layout = blobLayout(metrics, {
    cardGrowth,
    railLength,
    joinOffset: join,
    cardHeight: height,
  });
  const pad = framePadding(metrics, cardGrowth, style);
  const visible = open && !dragging;
  const interactive = visible;
  const shadow = `drop-shadow(0 ${Math.round(
    MOTION.shadowDy * metrics.unit,
  )}px ${Math.round(MOTION.shadowBlur * metrics.unit)}px ${theme.shadow})`;
  const alongPadding = compact ? metrics.notchPaddingY : metrics.railPaddingY;
  const railPadding =
    orientation === "vertical"
      ? `${alongPadding}px ${metrics.railPaddingX}px`
      : `${metrics.railPaddingX}px ${alongPadding}px`;

  const railShape = railPath(metrics, cardGrowth, layout, { notch, style });
  const bubbleShape = bubblePath(metrics, cardGrowth, layout);

  // Serialised so the effect fires on a geometry change rather than on every
  // render, since the regions themselves are rebuilt each time.
  const hitKey = JSON.stringify(hitRegions(layout, pad, interactive));
  useEffect(() => {
    onHitRegions?.(JSON.parse(hitKey) as HitRegions);
  }, [hitKey, onHitRegions]);

  return (
    <div
      data-hud-frame="true"
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
            filter: shadow,
            transform: dragging ? `scale(${MOTION.liftScale})` : "scale(1)",
            transformOrigin: railOrigin(cardGrowth),
            transition: `transform ${MOTION.openMs}ms ${MOTION.easing}`,
          }}
        >
          <path
            d={railShape}
            fill={theme.surface}
            data-hud-hit="true"
            style={{
              pointerEvents: "fill",
              cursor: dragging ? "grabbing" : "grab",
            }}
          />
          {style.outline ? (
            <path
              d={railShape}
              fill="none"
              stroke={theme.surfaceEdge}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          ) : null}
        </svg>

        <div
          data-hud-bubble="true"
          data-card-open={open ? "true" : "false"}
          style={{
            position: "absolute",
            inset: 0,
            opacity: visible ? 1 : 0,
            transform: visible
              ? "scale(1)"
              : `scale(${MOTION.closedBubbleScale})`,
            transformOrigin: bubbleOrigin(layout),
            transition: visible
              ? `opacity ${MOTION.openMs}ms ${MOTION.easing}, transform ${MOTION.openMs}ms ${MOTION.popEasing}`
              : `opacity ${MOTION.closeMs}ms ${MOTION.closeEasing}, transform ${MOTION.closeMs}ms ${MOTION.closeEasing}`,
            pointerEvents: "none",
            willChange: "transform, opacity",
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              pointerEvents: "none",
              filter: shadow,
            }}
          >
            <path
              d={bubbleShape}
              fill={theme.surface}
              data-hud-hit={interactive ? "true" : undefined}
              style={{ pointerEvents: interactive ? "fill" : "none" }}
            />
            {style.outline ? (
              <path
                d={bubbleShape}
                fill="none"
                stroke={theme.surfaceEdge}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
            ) : null}
          </svg>
          <div
            data-card-wrap="true"
            data-hud-hit={interactive ? "true" : undefined}
            style={{
              position: "absolute",
              left: layout.card.x,
              top: layout.card.y,
              width: layout.card.width,
              height: layout.card.height,
              boxSizing: "border-box",
              pointerEvents: interactive ? "auto" : "none",
            }}
          >
            {card}
          </div>
        </div>

        <div
          data-hud-rail="true"
          style={{
            position: "absolute",
            left: layout.rail.x,
            top: layout.rail.y,
            width: layout.rail.width,
            height: layout.rail.height,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: orientation === "vertical" ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: metrics.itemGap,
            padding: railPadding,
            pointerEvents: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          {rail}
        </div>
      </div>
    </div>
  );
}

function railOrigin(growth: CardGrowth): string {
  if (growth === "left") {
    return "right center";
  }
  if (growth === "right") {
    return "left center";
  }
  if (growth === "up") {
    return "center bottom";
  }
  return "center top";
}
