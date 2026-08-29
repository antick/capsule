import { HUD, MOTION } from "@capsule/config";
import type { CSSProperties, ReactElement, ReactNode } from "react";

export type CardGrowth = "left" | "right" | "up" | "down";

export function HudFrame({
  orientation,
  cardGrowth,
  open,
  joinOffset,
  dragging,
  rail,
  card,
}: {
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  open: boolean;
  joinOffset: number;
  dragging: boolean;
  rail: ReactNode;
  card: ReactNode;
}): ReactElement {
  const radius = HUD.railRadius;
  const motion = `${MOTION.cardMs}ms ${MOTION.easing}`;
  const railStyle: CSSProperties = {
    background: HUD.surface,
    display: "flex",
    flexDirection: orientation === "vertical" ? "column" : "row",
    alignItems: "center",
    justifyContent: "center",
    gap: HUD.itemGap,
    padding:
      orientation === "vertical"
        ? `${HUD.railPaddingY}px ${HUD.railPaddingX}px`
        : `${HUD.railPaddingX}px ${HUD.railPaddingY}px`,
    width: orientation === "vertical" ? HUD.railWidth : "auto",
    height: orientation === "horizontal" ? HUD.railWidth : "auto",
    boxSizing: "border-box",
    borderRadius: radius,
    position: "relative",
    zIndex: 2,
    boxShadow: MOTION.railShadow,
    cursor: dragging ? "grabbing" : "grab",
    transition: `transform ${motion}, box-shadow ${motion}`,
    transform: dragging ? "scale(1.02)" : "scale(1)",
  };

  const cardWrapStyle: CSSProperties = {
    background: HUD.surface,
    borderRadius: HUD.cardRadius,
    position: "relative",
    marginTop: orientation === "vertical" ? Math.max(0, joinOffset - 86) : 0,
    opacity: open && !dragging ? 1 : 0,
    transform: cardTransform(open && !dragging, cardGrowth),
    transformOrigin: cardOrigin(cardGrowth),
    transition: `opacity ${motion}, transform ${motion}`,
    pointerEvents: open && !dragging ? "auto" : "none",
    boxShadow: MOTION.railShadow,
  };

  const direction: CSSProperties =
    cardGrowth === "left"
      ? { flexDirection: "row" }
      : cardGrowth === "right"
        ? { flexDirection: "row-reverse" }
        : cardGrowth === "up"
          ? { flexDirection: "column-reverse" }
          : { flexDirection: "column" };

  return (
    <div
      data-hud-frame="true"
      style={{
        display: "flex",
        alignItems: "flex-start",
        fontFamily: HUD.fontFamily,
        color: HUD.text,
        ...direction,
      }}
    >
      <div
        data-card-wrap="true"
        data-card-open={open ? "true" : "false"}
        style={cardWrapStyle}
      >
        {card}
        <span style={tail(cardGrowth)} />
      </div>
      <div data-hud-rail="true" style={railStyle}>
        {rail}
      </div>
    </div>
  );
}

function cardOrigin(growth: CardGrowth): string {
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

function cardTransform(open: boolean, growth: CardGrowth): string {
  if (open) {
    return "translate(0, 0) scale(1)";
  }
  const shift = MOTION.closedCardShiftPx;
  const scale = MOTION.closedCardScale;
  if (growth === "left") {
    return `translateX(${shift}px) scale(${scale})`;
  }
  if (growth === "right") {
    return `translateX(-${shift}px) scale(${scale})`;
  }
  if (growth === "up") {
    return `translateY(${shift}px) scale(${scale})`;
  }
  return `translateY(-${shift}px) scale(${scale})`;
}

function tail(growth: CardGrowth): CSSProperties {
  const size = HUD.joinSize;
  const base: CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    pointerEvents: "none",
  };
  if (growth === "left") {
    return {
      ...base,
      right: -size + 1,
      top: 72,
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderLeft: `${size}px solid ${HUD.surface}`,
    };
  }
  if (growth === "right") {
    return {
      ...base,
      left: -size + 1,
      top: 72,
      borderTop: `${size}px solid transparent`,
      borderBottom: `${size}px solid transparent`,
      borderRight: `${size}px solid ${HUD.surface}`,
    };
  }
  if (growth === "up") {
    return {
      ...base,
      bottom: -size + 1,
      left: "50%",
      marginLeft: -size,
      borderLeft: `${size}px solid transparent`,
      borderRight: `${size}px solid transparent`,
      borderTop: `${size}px solid ${HUD.surface}`,
    };
  }
  return {
    ...base,
    top: -size + 1,
    left: "50%",
    marginLeft: -size,
    borderLeft: `${size}px solid transparent`,
    borderRight: `${size}px solid transparent`,
    borderBottom: `${size}px solid ${HUD.surface}`,
  };
}
