import { HUD } from "@capsule/config";
import type { CSSProperties, ReactElement, ReactNode } from "react";

export type CardGrowth = "left" | "right" | "up";

export function HudFrame({
  orientation,
  cardGrowth,
  open,
  joinOffset,
  rail,
  card,
}: {
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  open: boolean;
  joinOffset: number;
  rail: ReactNode;
  card: ReactNode;
}): ReactElement {
  const radius = HUD.railRadius;
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
    borderRadius: open ? railRadius(cardGrowth, radius) : radius,
    position: "relative",
    zIndex: 1,
  };

  const cardWrapStyle: CSSProperties = {
    background: HUD.surface,
    borderRadius: HUD.cardRadius,
    position: "relative",
    marginTop: orientation === "vertical" ? Math.max(0, joinOffset - 86) : 0,
    display: open ? "block" : "none",
  };

  const tailStyle: CSSProperties = tail(cardGrowth);

  const direction: CSSProperties =
    cardGrowth === "left"
      ? { flexDirection: "row" }
      : cardGrowth === "right"
        ? { flexDirection: "row-reverse" }
        : { flexDirection: "column-reverse" };

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
      <div style={cardWrapStyle}>
        {card}
        <span style={tailStyle} />
      </div>
      <div data-hud-rail="true" style={railStyle}>
        {rail}
      </div>
    </div>
  );
}

function railRadius(growth: CardGrowth, radius: number): string {
  if (growth === "left") {
    return `${radius}px 0 0 ${radius}px`;
  }
  if (growth === "right") {
    return `0 ${radius}px ${radius}px 0`;
  }
  return `${radius}px ${radius}px 0 0`;
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
