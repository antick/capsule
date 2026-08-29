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
  cardOrigin,
  framePadding,
  type HitRegions,
  hitRegions,
  latchHotZone,
  latchRect,
  peekShift,
  railPath,
} from "./blob-path.ts";
import { dockShadow } from "./shadow.ts";
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
  railBias = null,
  peek = false,
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
  /** Where the rail sits inside the frame, from the placement engine. */
  railBias?: number | null;
  /** Retracted into the screen edge, showing only its latch. */
  peek?: boolean;
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
    cardReserve: cardHeightForBuckets(metrics, HUD.maxCardBuckets),
    style,
    railBias,
  });
  const pad = framePadding(metrics, cardGrowth, style);
  const visible = open && !dragging && !peek;
  const interactive = visible;
  const shift = peekShift(metrics, cardGrowth, layout);
  const latch = latchRect(metrics, cardGrowth, layout);
  const zone = latchHotZone(metrics, cardGrowth, layout);
  // The rail rides out to the edge and back; the latch cross-fades with it so
  // the dock never reads as two objects at once.
  const unroll = {
    transform: peek ? `translate(${shift.x}px, ${shift.y}px)` : "translate(0)",
    transition: `transform ${peek ? MOTION.peekOutMs : MOTION.peekMs}ms ${
      peek ? MOTION.closeEasing : MOTION.popEasing
    }`,
    willChange: "transform",
  } as const;
  const shadow = dockShadow(metrics, theme);
  const alongPadding = compact ? metrics.notchPaddingY : metrics.railPaddingY;
  const railPadding =
    orientation === "vertical"
      ? `${alongPadding}px ${metrics.railPaddingX}px`
      : `${metrics.railPaddingX}px ${alongPadding}px`;

  const railShape = railPath(metrics, cardGrowth, layout, { notch, style });
  const bubbleShape = bubblePath(metrics, cardGrowth, layout);
  // The card's own reveal, shared by its silhouette and its contents — they
  // live in different layers so that the shadow filter never touches the text.
  const reveal = {
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : `scale(${MOTION.closedBubbleScale})`,
    transition: visible
      ? `opacity ${MOTION.openMs}ms ${MOTION.easing}, transform ${MOTION.openMs}ms ${MOTION.popEasing}`
      : `opacity ${MOTION.closeMs}ms ${MOTION.closeEasing}, transform ${MOTION.closeMs}ms ${MOTION.closeEasing}`,
    willChange: "transform, opacity",
  } as const;

  // Serialised so the effect fires on a geometry change rather than on every
  // render, since the regions themselves are rebuilt each time.
  const hitKey = JSON.stringify(
    hitRegions(
      layout,
      pad,
      interactive,
      peek ? { metrics, growth: cardGrowth } : null,
    ),
  );
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
        {/* Rail and card share one shadow. Giving each its own would print the
            card's shadow across the rail at the join and split the surface in
            two again. */}
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
              transformOrigin: railOrigin(cardGrowth),
              ...unroll,
              transform: `${unroll.transform} ${
                dragging ? `scale(${MOTION.liftScale})` : "scale(1)"
              }`,
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
              transformOrigin: bubbleOrigin(layout),
              ...reveal,
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
        </div>

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
            transformOrigin: cardOrigin(layout),
            pointerEvents: interactive ? "auto" : "none",
            ...reveal,
          }}
        >
          {card}
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
            ...unroll,
          }}
        >
          {rail}
        </div>

        {/* The hot zone is the element the pointer meets; the tab is painted
            inside it. Making the tab itself interactive would mean aiming at
            five pixels of screen edge. */}
        <div
          data-hud-latch="true"
          data-hud-hit={peek ? "true" : undefined}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
            opacity: peek ? 1 : 0,
            // Out of the way the instant the rail starts arriving, back only
            // once it has left: the two never share the edge.
            transition: peek
              ? `opacity ${MOTION.peekOutMs}ms ${MOTION.closeEasing} ${MOTION.peekOutMs}ms`
              : `opacity ${MOTION.closeMs}ms ${MOTION.closeEasing}`,
            pointerEvents: peek ? "auto" : "none",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: latch.x - zone.x,
              top: latch.y - zone.y,
              width: latch.width,
              height: latch.height,
              borderRadius: latch.width / 2 + latch.height / 2,
              background: theme.surface,
              // A hairline as well as the fill: the tab is the dock's whole
              // presence at rest, and a black tab on a black wallpaper is no
              // presence at all.
              boxShadow: `inset 0 0 0 1px ${theme.surfaceEdge}`,
              filter: shadow,
            }}
          />
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
