import { HUD, MOTION, railLengthForCount } from "@capsule/config";
import type { ReactElement, ReactNode } from "react";
import {
  blobLayout,
  type CardGrowth,
  cardPath,
  flushClipRect,
  flushPadding,
  railPath,
  tailPath,
} from "./blob-path.ts";
import { useAnimatedNumber } from "./use-animated-number.ts";

export type { CardGrowth };

export function HudFrame({
  orientation,
  cardGrowth,
  open,
  joinOffset,
  dragging,
  meterCount,
  rail,
  card,
}: {
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  open: boolean;
  joinOffset: number;
  dragging: boolean;
  meterCount: number;
  rail: ReactNode;
  card: ReactNode;
}): ReactElement {
  const railLength = railLengthForCount(meterCount);
  const join = useAnimatedNumber(joinOffset, MOTION.blobMs);
  const progress = useAnimatedNumber(open && !dragging ? 1 : 0, MOTION.blobMs);
  const layout = blobLayout({
    cardGrowth,
    railLength,
    joinOffset: join,
  });
  const pad = flushPadding(cardGrowth);
  const clip = flushClipRect(cardGrowth, layout);
  const showCard = progress > 0.02;
  const cardHits = progress > 0.55 && !dragging;
  const motion = `${MOTION.cardMs}ms ${MOTION.easing}`;
  const railD = railPath(cardGrowth, layout.rail);
  const gooMatrix = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${HUD.blobGooAlpha} ${HUD.blobGooBias}`;

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
          data-hud-blob="true"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            overflow: "visible",
            pointerEvents: "none",
            filter: `drop-shadow(0 ${MOTION.shadowDy}px ${MOTION.shadowBlur}px rgba(0, 0, 0, ${MOTION.shadowOpacity}))`,
            transform: dragging ? `scale(${MOTION.liftScale})` : "scale(1)",
            transformOrigin: blobOrigin(cardGrowth),
            transition: `transform ${motion}`,
          }}
        >
          <defs>
            <filter
              id="capsule-hud-goo"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={HUD.blobBlur}
                result="blur"
              />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values={gooMatrix}
                result="goo"
              />
            </filter>
            <clipPath id="capsule-hud-flush">
              <rect
                x={clip.x}
                y={clip.y}
                width={clip.width}
                height={clip.height}
              />
            </clipPath>
          </defs>
          <g clipPath="url(#capsule-hud-flush)">
            <g filter={showCard ? "url(#capsule-hud-goo)" : undefined}>
              <path d={railD} fill={HUD.surface} />
              {showCard ? (
                <>
                  <path
                    d={cardPath(layout.card)}
                    fill={HUD.surface}
                    opacity={progress}
                  />
                  <path
                    d={tailPath(cardGrowth, layout.card, layout.rail, join)}
                    fill={HUD.surface}
                    opacity={progress}
                  />
                  <circle
                    cx={layout.join.x}
                    cy={layout.join.y}
                    r={HUD.connectorRadius}
                    fill={HUD.surface}
                    opacity={progress}
                  />
                </>
              ) : null}
            </g>
            <path d={railD} fill={HUD.surface} />
            {showCard ? (
              <path
                d={cardPath(layout.card)}
                fill={HUD.surface}
                opacity={progress}
              />
            ) : null}
          </g>
        </svg>
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
          }}
        >
          <path
            d={railD}
            fill="transparent"
            data-hud-hit="true"
            style={{
              pointerEvents: "fill",
              cursor: dragging ? "grabbing" : "grab",
            }}
          />
          {cardHits ? (
            <>
              <path
                d={cardPath(layout.card)}
                fill="transparent"
                data-hud-hit="true"
                style={{ pointerEvents: "fill" }}
              />
              <path
                d={tailPath(cardGrowth, layout.card, layout.rail, join)}
                fill="transparent"
                data-hud-hit="true"
                style={{ pointerEvents: "fill" }}
              />
            </>
          ) : null}
        </svg>
        <div
          data-card-wrap="true"
          data-card-open={open ? "true" : "false"}
          data-hud-hit={cardHits ? "true" : "false"}
          style={{
            position: "absolute",
            left: layout.card.x,
            top: layout.card.y,
            width: layout.card.width,
            boxSizing: "border-box",
            opacity: progress,
            transform: cardTransform(progress, cardGrowth),
            transformOrigin: cardOrigin(cardGrowth),
            pointerEvents: cardHits ? "auto" : "none",
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

function blobOrigin(growth: CardGrowth): string {
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

function cardOrigin(growth: CardGrowth): string {
  return blobOrigin(growth);
}

function cardTransform(progress: number, growth: CardGrowth): string {
  const scale =
    MOTION.closedCardScale + (1 - MOTION.closedCardScale) * progress;
  const shift = MOTION.closedCardShiftPx * (1 - progress);
  if (growth === "left") {
    return `translateX(${shift}px) scale(${scale})`;
  }
  if (growth === "right") {
    return `translateX(${-shift}px) scale(${scale})`;
  }
  if (growth === "up") {
    return `translateY(${shift}px) scale(${scale})`;
  }
  return `translateY(${-shift}px) scale(${scale})`;
}
