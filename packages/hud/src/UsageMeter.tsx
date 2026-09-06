import {
  ACTIVITY_NOTICES,
  type ActivitySummary,
  activityColor,
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
  type UsageDisplay,
} from "@capsule/config";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

export function UsageMeter({
  metrics,
  theme = HUD_THEMES.midnight,
  providerId,
  percent,
  display = "used",
  active,
  compact = false,
  refreshing = false,
  activity = null,
  waitingCount = 0,
  noticeCount = 0,
  stowed = false,
  stowShift = { x: 0, y: 0 },
  revealDelayMs = 0,
  onPointerEnter,
  onPointerLeave,
  onClick,
  onNoticeClick,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  providerId: ProviderId;
  percent: number | null;
  /** Whether the ring and caption count what is used or what is left. */
  display?: UsageDisplay;
  active: boolean;
  /** Horizontal docks drop the percent caption so they stay edge-thin. */
  compact?: boolean;
  /** A fetch is in the air: chase the ring until it lands. */
  refreshing?: boolean;
  /** What this provider's agents are doing right now, if anything. */
  activity?: ActivitySummary | null;
  waitingCount?: number;
  noticeCount?: number;
  /** Riding out of view with a retracted dock. */
  stowed?: boolean;
  /** Which way, and how far, it slides toward the edge while stowed. */
  stowShift?: { x: number; y: number };
  /** Held back this long on the way in, so the meters arrive in order. */
  revealDelayMs?: number;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
  onNoticeClick?: () => void;
}): ReactElement {
  const size = metrics.meterSize;
  const stroke = metrics.ringStroke;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = percent === null ? null : Math.round(percent);
  // The colour always answers "how close to the wall", whichever end the
  // number is read from.
  const severity = rounded === null ? null : severityForPercent(rounded);
  const color = severity ? SEVERITY_COLORS[severity] : theme.ringTrack;
  const shown =
    rounded === null ? null : display === "remaining" ? 100 - rounded : rounded;
  const dashOffset =
    shown === null
      ? circumference
      : circumference - (shown / 100) * circumference;
  const workingCount =
    activity?.sessions.filter(
      (session) => session.state === "busy" && session.confirmed !== false,
    ).length ?? 0;
  const needsInput = Math.max(
    waitingCount,
    activity?.sessions.filter(
      (session) => session.state === "waiting" && session.confirmed !== false,
    ).length ?? 0,
  );
  const label = shown === null ? "—" : `${shown}${COPY.percentSuffix}`;
  const accessibleLabel = `${providerId} ${label}`;
  const activityRadius = (metrics.activitySize - metrics.activityStroke) / 2;
  const activityLap = 2 * Math.PI * activityRadius;
  const arrive = springTransition(SPRINGS.contents);
  const reading = springTransition(SPRINGS.reading);
  const press = springTransition(SPRINGS.press);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
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
      <button
        type="button"
        data-provider={providerId}
        data-active={active ? "true" : "false"}
        onPointerEnter={onPointerEnter}
        onMouseEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        data-hud-hit="true"
        title={accessibleLabel}
        aria-label={accessibleLabel}
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
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={accessibleLabel}
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
          {shown !== null && shown > 0 ? (
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
          {activity && activity.state !== "idle" ? (
            // A second, thinner arc inside the ring, in the gap between the
            // glyph and the track: a different radius, weight and colour, so it
            // reads as a separate fact rather than as the usage number moving.
            // It spins while an agent works and breathes while one waits on you.
            <circle
              data-hud-activity={activity.state}
              cx={size / 2}
              cy={size / 2}
              r={activityRadius}
              fill="none"
              stroke={activityColor(activity.state, theme)}
              strokeWidth={metrics.activityStroke}
              strokeLinecap="round"
              strokeDasharray={
                activity.state === "working"
                  ? `${activityLap * MOTION.activityArc} ${activityLap}`
                  : undefined
              }
              style={
                activity.state === "working"
                  ? {
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: `capsule-sweep ${MOTION.activitySpinMs}ms linear infinite`,
                    }
                  : {
                      animation: `capsule-pulse ${MOTION.activityPulseMs}ms ease-in-out infinite alternate`,
                    }
              }
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
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        )}
      </button>
      {needsInput > 0 || noticeCount > 0 || workingCount > 0 ? (
        <button
          type="button"
          data-hud-hit="true"
          data-waiting-count={needsInput}
          data-notice-count={noticeCount}
          aria-label={`${providerId} ${noticeCount || needsInput || workingCount} ${COPY.noticeTitle}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (noticeCount > 0) onNoticeClick?.();
            else onClick();
          }}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: metrics.cardStatusDot * 2,
            height: metrics.cardStatusDot * 2,
            border: 0,
            borderRadius: "50%",
            padding: 0,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            pointerEvents: "auto",
            color: theme.surface,
            fontSize: metrics.percentFontSize,
            fontWeight: 600,
            background:
              needsInput > 0
                ? ACTIVITY_NOTICES.waitingColor[theme.appearance]
                : noticeCount > 0
                  ? ACTIVITY_NOTICES.completedColor[theme.appearance]
                  : theme.text,
          }}
        >
          {needsInput || noticeCount || workingCount}
        </button>
      ) : null}
    </span>
  );
}
