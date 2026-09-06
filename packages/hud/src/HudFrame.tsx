import {
  type ActivityState,
  activityColor,
  cardHeightForBuckets,
  cardReserveHeight,
  DOCK_STYLES,
  type DockStyle,
  type HardwareNotch,
  HUD,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  MOTION,
  SPRINGS,
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
} from "./blob-path.ts";
import {
  latchHotZone,
  latchRect,
  railMorph,
  restingRail,
} from "./latch-path.ts";
import { cardReveal } from "./reveal.ts";
import { dockShadow } from "./shadow.ts";
import { useSpring } from "./use-spring.ts";

export type { CardGrowth, HitRegions };

export function HudFrame({
  metrics,
  theme = HUD_THEMES.midnight,
  style = DOCK_STYLES.rail,
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
  hardwareNotch = null,
  beacon = null,
  rail,
  card,
  onHitRegions,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  style?: DockStyle;
  /** Kept for callers that still pass it; the growth direction decides. */
  orientation?: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  notch?: boolean;
  /** Horizontal docks drop the percent caption to stay edge-thin. */
  compact?: boolean;
  open: boolean;
  joinOffset: number;
  dragging: boolean;
  railLength: number;
  cardHeight?: number;
  /** Where the rail sits in the frame, from the placement engine. */
  railBias?: number | null;
  /** Retracted into the screen edge, showing only its latch. */
  peek?: boolean;
  /**
   * The display's own notch, when this rail is drawn as it: flush to the
   * bezel, no flares, deeper by the notch's height so the readings sit below
   * the hole, and folding away to exactly the notch's shape.
   */
  hardwareNotch?: HardwareNotch | null;
  /**
   * What the folded dock carries as a dot: amber while an agent waits on you,
   * white while one works. The glance has to work while the dock is hidden,
   * which is when it matters most.
   */
  beacon?: Exclude<ActivityState, "idle"> | null;
  rail: ReactNode;
  card: ReactNode;
  onHitRegions?: (regions: HitRegions) => void;
}): ReactElement {
  const height = cardHeight ?? cardHeightForBuckets(metrics, 2);
  // The tail glides between meters and the card's height follows a swap, on
  // the same spring, so the card and its tail never come apart on the way.
  const join = useSpring(joinOffset, SPRINGS.glide);
  const cardAlong = useSpring(height, SPRINGS.glide);
  // 0 is the resting latch, 1 the open rail. One shape morphs between the
  // two: the latch *is* the rail, folded down to a sliver on the edge.
  const openness = useSpring(peek ? 0 : 1, SPRINGS.unfold);
  const joined = hardwareNotch;
  const inset = joined?.height ?? 0;
  const flare = joined
    ? metrics.notchBezelFillet
    : metrics.edgeFlare * style.flare;
  const shape = {
    cardGrowth,
    railLength,
    cardReserve: cardReserveHeight(metrics),
    style,
    railBias,
    railDepth: metrics.railWidth + inset,
    flare,
  };
  const layout = blobLayout(metrics, {
    ...shape,
    joinOffset: join,
    cardHeight: cardAlong,
  });
  // Where everything will be once it has stopped moving. The hit regions are
  // cut from this rather than from each frame in between, so the pointer is
  // answered by where the card is going, and main is not told about a new
  // region sixty times a second.
  const settled = blobLayout(metrics, {
    ...shape,
    joinOffset,
    cardHeight: height,
  });
  const pad = framePadding(metrics, cardGrowth, style);
  const visible = open && !dragging && !peek;
  const interactive = visible;
  const zone = latchHotZone(metrics, cardGrowth, settled, joined);
  const tab = latchRect(metrics, cardGrowth, settled, joined);
  const shadow = dockShadow(metrics, theme);
  const railPadding = railPaddingFor(metrics, cardGrowth, compact, inset);

  const morph = railMorph(metrics, cardGrowth, layout, openness, {
    notch,
    style,
    flare,
    resting: restingRail(metrics, layout, joined),
  });
  // Still folding, one way or the other: the meters are masked by the outline
  // so the shape swallows them rather than letting them slide out of its end.
  const folding = openness < 1;
  const bubbleShape = bubblePath(metrics, cardGrowth, layout);
  // The card's own reveal, shared by its silhouette and its contents — they
  // live in different layers so that the shadow filter never touches the text.
  const reveal = cardReveal(visible);

  // Serialised so the effect fires on a geometry change rather than on every
  // render, since the regions themselves are rebuilt each time.
  const hitKey = JSON.stringify(
    hitRegions(settled, pad, interactive, peek ? zone : null),
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
              transform: dragging ? `scale(${MOTION.liftScale})` : "scale(1)",
            }}
          >
            <path
              d={morph.path}
              fill={theme.surface}
              data-hud-hit="true"
              style={{
                pointerEvents: "fill",
                cursor: dragging ? "grabbing" : "grab",
              }}
            />
            {/* A hairline as well as the fill while the dock is folded: the
                latch is its whole presence at rest, and a black sliver on a
                black wallpaper is no presence at all. Outlined styles keep it
                open too. */}
            {beacon && folding ? (
              <g
                data-hud-beacon={beacon}
                style={{ opacity: 1 - openness, pointerEvents: "none" }}
              >
                {beacon === "waiting" ? (
                  <circle
                    cx={tab.x + tab.width / 2}
                    cy={tab.y + tab.height / 2}
                    r={metrics.beaconSize}
                    fill={activityColor("waiting", theme)}
                    opacity={MOTION.activityPulseFloor}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: `capsule-pulse ${MOTION.activityPulseMs}ms ease-in-out infinite alternate`,
                    }}
                  />
                ) : null}
                <circle
                  cx={tab.x + tab.width / 2}
                  cy={tab.y + tab.height / 2}
                  r={metrics.beaconSize / 2}
                  fill={activityColor(beacon, theme)}
                />
              </g>
            ) : null}
            {style.outline || (folding && !joined) ? (
              <path
                d={morph.path}
                fill="none"
                stroke={theme.surfaceEdge}
                strokeWidth={1}
                style={{
                  pointerEvents: "none",
                  opacity: style.outline ? 1 : 1 - openness,
                }}
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
            // The contents are laid out once at their natural size; it is the
            // box that changes size over them while a swap eases through.
            overflow: "hidden",
            borderRadius: metrics.cardRadius,
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
            flexDirection: isVertical(cardGrowth) ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: metrics.itemGap,
            padding: railPadding,
            pointerEvents: "none",
            cursor: dragging ? "grabbing" : "grab",
            clipPath: folding ? `path("${morph.clip}")` : undefined,
          }}
        >
          {rail}
        </div>

        {/* The band the pointer meets while the dock rests. The latch itself is
            a few pixels of edge and no target at all, so it answers to this
            wider, invisible zone instead. */}
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
            pointerEvents: peek ? "auto" : "none",
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Room inside the rail around the meters. The side facing the screen edge
 * carries the extra `inset` a bar drawn as the display's notch needs, so the
 * readings start below the hole rather than inside it.
 */
function railPaddingFor(
  m: HudMetrics,
  growth: CardGrowth,
  compact: boolean | undefined,
  inset: number,
): string {
  const along = compact ? m.notchPaddingY : m.railPaddingY;
  const across = m.railPaddingX;
  const edge = across + inset;
  if (growth === "left") {
    return `${along}px ${edge}px ${along}px ${across}px`;
  }
  if (growth === "right") {
    return `${along}px ${across}px ${along}px ${edge}px`;
  }
  if (growth === "up") {
    return `${across}px ${along}px ${edge}px ${along}px`;
  }
  return `${edge}px ${along}px ${across}px ${along}px`;
}

function isVertical(growth: CardGrowth): boolean {
  return growth === "left" || growth === "right";
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
