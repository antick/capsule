import {
  COPY,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  MOTION,
  type ProviderId,
  SEVERITY_COLORS,
  SPRINGS,
  severityForPercent,
  springTransition,
} from "@capsule/config";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

export function UsageMeter({
  metrics,
  theme = HUD_THEMES.midnight,
  providerId,
  percent,
  active,
  compact = false,
  refreshing = false,
  stowed = false,
  stowShift = { x: 0, y: 0 },
  revealDelayMs = 0,
  onPointerEnter,
  onPointerLeave,
  onClick,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  providerId: ProviderId;
  percent: number | null;
  active: boolean;
  /** Horizontal docks drop the percent caption so they stay edge-thin. */
  compact?: boolean;
  /** A fetch is in the air: chase the ring until it lands. */
  refreshing?: boolean;
  /** Riding out of view with a retracted dock. */
  stowed?: boolean;
  /** Which way, and how far, it slides toward the edge while stowed. */
  stowShift?: { x: number; y: number };
  /** Held back this long on the way in, so the meters arrive in order. */
  revealDelayMs?: number;
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
  const color = severity ? SEVERITY_COLORS[severity] : theme.ringTrack;
  const dashOffset =
    rounded === null
      ? circumference
      : circumference - (rounded / 100) * circumference;
  const label = rounded === null ? "—" : `${rounded}${COPY.percentSuffix}`;
  const arrive = springTransition(SPRINGS.contents);
  const reading = springTransition(SPRINGS.reading);
  const press = springTransition(SPRINGS.press);

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
        color: theme.text,
        pointerEvents: "auto",
        // Meters keep a fixed size; the card's tail marks the active one.
        opacity: stowed ? 0 : active ? 1 : MOTION.meterIdleOpacity,
        // Folded away, each meter slides a little toward the edge and fades,
        // trailing the one before it, so the rail reads as unrolling rather
        // than arriving whole. The shape's own outline does the concealing.
        transform: stowed
          ? `translate(${stowShift.x}px, ${stowShift.y}px)`
          : "translate(0px, 0px)",
        transition: `opacity ${arrive.durationMs}ms ${arrive.easing} ${revealDelayMs}ms, transform ${arrive.durationMs}ms ${arrive.easing} ${revealDelayMs}ms`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${providerId} ${rounded === null ? "unknown" : `${rounded}%`}`}
        style={{
          display: "block",
          // Pressed in while it works, released when the answer lands. The
          // ring is the button, so the ring is what should feel pressed.
          transform: refreshing
            ? `scale(${MOTION.refreshPressScale})`
            : "scale(1)",
          transition: `transform ${press.durationMs}ms ${press.easing}`,
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.ringTrack}
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
              // A ring that snaps to a new value reads as a glitch; one that
              // sweeps reads as a measurement being taken.
              transition: `stroke-dashoffset ${reading.durationMs}ms ${reading.easing}, stroke ${MOTION.meterMs}ms ${MOTION.easing}`,
            }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
        {refreshing ? (
          <circle
            data-hud-sweep="true"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.text}
            strokeWidth={stroke}
            strokeLinecap="round"
            // A short bright segment with the rest of the lap left empty, spun
            // round the ring: the arc underneath keeps showing the real number
            // while the sweep says the number is being checked.
            strokeDasharray={`${circumference * MOTION.sweepArc} ${circumference}`}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `capsule-sweep ${MOTION.sweepMs}ms linear infinite`,
            }}
          />
        ) : null}
        <g
          transform={`translate(${(size - metrics.iconSize) / 2} ${(size - metrics.iconSize) / 2})`}
        >
          <ProviderIcon
            id={providerId}
            color={theme.text}
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
