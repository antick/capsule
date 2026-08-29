import {
  COPY,
  HUD,
  type HudMetrics,
  MOTION,
  type ProviderId,
  SEVERITY_COLORS,
  severityForPercent,
} from "@capsule/config";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

export function UsageMeter({
  metrics,
  providerId,
  percent,
  active,
  compact = false,
  onPointerEnter,
  onPointerLeave,
  onClick,
}: {
  metrics: HudMetrics;
  providerId: ProviderId;
  percent: number | null;
  active: boolean;
  /** Notch mode drops the percent caption so the dock stays menu-bar tall. */
  compact?: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
}): ReactElement {
  const size = metrics.meterSize;
  const stroke = metrics.ringStroke;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = percent === null ? null : Math.round(percent);
  const severity = rounded === null ? null : severityForPercent(rounded);
  const color = severity ? SEVERITY_COLORS[severity] : HUD.ringTrack;
  const dashOffset =
    rounded === null
      ? circumference
      : circumference - (rounded / 100) * circumference;
  const label = rounded === null ? "—" : `${rounded}${COPY.percentSuffix}`;

  return (
    <button
      type="button"
      data-provider={providerId}
      data-active={active ? "true" : "false"}
      onPointerEnter={onPointerEnter}
      onMouseEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      data-hud-hit="true"
      title={`${providerId} ${label}`}
      style={{
        appearance: "none",
        background: "transparent",
        border: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: metrics.meterLabelGap,
        cursor: "pointer",
        color: HUD.text,
        pointerEvents: "auto",
        // Meters keep a fixed size; the card's tail marks the active one.
        opacity: active ? 1 : MOTION.meterIdleOpacity,
        transition: `opacity ${MOTION.meterMs}ms ${MOTION.easing}`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${providerId} ${rounded === null ? "unknown" : `${rounded}%`}`}
        style={{ display: "block" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={HUD.ringTrack}
          strokeWidth={stroke}
        />
        {rounded !== null && rounded > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: `stroke-dashoffset ${MOTION.ringMs}ms ${MOTION.easing}, stroke ${MOTION.meterMs}ms ${MOTION.easing}`,
            }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
        <g
          transform={`translate(${(size - metrics.iconSize) / 2} ${(size - metrics.iconSize) / 2})`}
        >
          <ProviderIcon
            id={providerId}
            color={HUD.text}
            size={metrics.iconSize}
          />
        </g>
      </svg>
      {compact ? null : (
        <span
          style={{
            display: "block",
            height: metrics.percentBlock,
            lineHeight: `${metrics.percentBlock}px`,
            fontSize: metrics.percentFontSize,
            fontWeight: 400,
            letterSpacing: 0.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
