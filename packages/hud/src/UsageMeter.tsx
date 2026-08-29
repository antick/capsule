import {
  COPY,
  HUD,
  MOTION,
  type ProviderId,
  SEVERITY_COLORS,
  severityForPercent,
} from "@capsule/config";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

export function UsageMeter({
  providerId,
  percent,
  active,
  onPointerEnter,
  onPointerLeave,
  onClick,
}: {
  providerId: ProviderId;
  percent: number | null;
  active: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
}): ReactElement {
  const size = HUD.meterSize;
  const stroke = HUD.ringStroke;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = percent === null ? null : Math.round(percent);
  const severity = rounded === null ? null : severityForPercent(rounded);
  const color = severity ? SEVERITY_COLORS[severity] : HUD.ringTrack;
  const dashOffset =
    rounded === null
      ? circumference
      : circumference - (rounded / 100) * circumference;

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
      style={{
        appearance: "none",
        background: "transparent",
        border: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: HUD.meterLabelGap,
        cursor: "pointer",
        color: HUD.text,
        pointerEvents: "auto",
        transform: active ? `scale(${MOTION.meterHoverScale})` : "scale(1)",
        transition: `transform ${MOTION.meterMs}ms ${MOTION.easing}`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${providerId} ${rounded === null ? "unknown" : `${rounded}%`}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={HUD.ringTrack}
          strokeWidth={stroke}
        />
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
        <g
          transform={`translate(${(size - HUD.iconSize) / 2} ${(size - HUD.iconSize) / 2})`}
        >
          <ProviderIcon id={providerId} color={HUD.text} size={HUD.iconSize} />
        </g>
      </svg>
      <span
        style={{
          fontSize: HUD.percentFontSize,
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: 0.2,
        }}
      >
        {rounded === null ? "—" : `${rounded}${COPY.percentSuffix}`}
      </span>
    </button>
  );
}
