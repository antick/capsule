import { cardHeightForBuckets, HUD, MOTION } from "@capsule/config";
import type { ReactElement, ReactNode } from "react";
import {
  blobLayout,
  bubbleOrigin,
  bubblePath,
  type CardGrowth,
  framePadding,
  railPath,
} from "./blob-path.ts";
import { useAnimatedNumber } from "./use-animated-number.ts";

export type { CardGrowth };

const SHADOW = `drop-shadow(0 ${MOTION.shadowDy}px ${MOTION.shadowBlur}px rgba(0, 0, 0, ${MOTION.shadowOpacity}))`;

export function HudFrame({
  orientation,
  cardGrowth,
  open,
  joinOffset,
  dragging,
  railLength,
  cardHeight,
  rail,
  card,
}: {
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  open: boolean;
  joinOffset: number;
  dragging: boolean;
  railLength: number;
  cardHeight?: number;
  rail: ReactNode;
  card: ReactNode;
}): ReactElement {
  const height = cardHeight ?? cardHeightForBuckets(2);
  // The tail slides between meters instead of jumping.
  const join = useAnimatedNumber(joinOffset, MOTION.slideMs);
  const layout = blobLayout({
    cardGrowth,
    railLength,
    joinOffset: join,
    cardHeight: height,
  });
  const pad = framePadding(cardGrowth);
  const visible = open && !dragging;
  const interactive = visible;

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
        color: HUD.text,
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
            filter: SHADOW,
            transform: dragging ? `scale(${MOTION.liftScale})` : "scale(1)",
            transformOrigin: railOrigin(cardGrowth),
            transition: `transform ${MOTION.openMs}ms ${MOTION.easing}`,
          }}
        >
          <path
            d={railPath(cardGrowth, layout)}
            fill={HUD.surface}
            data-hud-hit="true"
            style={{
              pointerEvents: "fill",
              cursor: dragging ? "grabbing" : "grab",
            }}
          />
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
              filter: SHADOW,
            }}
          >
            <path
              d={bubblePath(cardGrowth, layout, join, height)}
              fill={HUD.surface}
              data-hud-hit={interactive ? "true" : undefined}
              style={{ pointerEvents: interactive ? "fill" : "none" }}
            />
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
            gap: HUD.itemGap,
            padding:
              orientation === "vertical"
                ? `${HUD.railPaddingY}px ${HUD.railPaddingX}px`
                : `${HUD.railPaddingX}px ${HUD.railPaddingY}px`,
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
