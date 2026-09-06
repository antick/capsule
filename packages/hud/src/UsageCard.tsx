import {
  type AgentSession,
  COPY,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  MOTION,
  orderSessions,
  SEVERITY_COLORS,
  sessionRowsShown,
  sessionStateColor,
  severityForPercent,
  type UsageSnapshot,
} from "@capsule/config";
import { formatAgo, formatElapsed, formatResetCopy } from "@capsule/dates";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

function BucketRow({
  metrics,
  theme,
  label,
  percentUsed,
  resetCopy,
}: {
  metrics: HudMetrics;
  theme: HudTheme;
  label: string;
  percentUsed: number;
  resetCopy: string;
}): ReactElement {
  const color = SEVERITY_COLORS[severityForPercent(percentUsed)];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: metrics.cardBucketGap,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: metrics.cardResetGap,
          height: metrics.cardTextLine,
          lineHeight: `${metrics.cardTextLine}px`,
        }}
      >
        <span style={{ fontSize: metrics.cardLabelSize, color: theme.text }}>
          {label}
        </span>
        <span
          style={{ fontSize: metrics.cardResetSize, color: theme.textMuted }}
        >
          {resetCopy}
        </span>
      </div>
      <div
        style={{
          height: metrics.barHeight,
          borderRadius: 99,
          background: theme.barTrack,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentUsed}%`,
            height: "100%",
            background: color,
            borderRadius: 99,
            transition: `width ${MOTION.barMs}ms ${MOTION.easing}`,
          }}
        />
      </div>
      <span
        style={{
          fontSize: metrics.cardLabelSize,
          color: theme.text,
          height: metrics.cardTextLine,
          lineHeight: `${metrics.cardTextLine}px`,
        }}
      >
        {percentUsed}
        {COPY.percentUsedSuffix}
      </span>
    </div>
  );
}

function Message({
  metrics,
  theme,
  text,
}: {
  metrics: HudMetrics;
  theme: HudTheme;
  text: string;
}): ReactElement {
  return (
    <p
      style={{
        margin: 0,
        fontSize: metrics.cardLabelSize,
        color: theme.textMuted,
        height: metrics.cardTextLine,
        lineHeight: `${metrics.cardTextLine}px`,
      }}
    >
      {text}
    </p>
  );
}

/** The tiny ring beside a session's status word: turning while the agent
 * works, half while it waits, whole when it is idle — so the row says what is
 * happening before the word is read. */
function StatusRing({
  metrics,
  state,
  color,
}: {
  metrics: HudMetrics;
  state: AgentSession["state"];
  color: string;
}): ReactElement {
  const size = metrics.cardStatusDot;
  const radius = (size - metrics.cardStatusStroke) / 2;
  const lap = 2 * Math.PI * radius;
  const trim = state === "busy" ? 0.75 : state === "waiting" ? 0.5 : 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle
        data-hud-status={state}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={metrics.cardStatusStroke}
        strokeLinecap="round"
        strokeDasharray={`${lap * trim} ${lap}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={
          state === "busy"
            ? {
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: `capsule-sweep ${MOTION.statusSpinMs}ms linear infinite`,
              }
            : undefined
        }
      />
    </svg>
  );
}

function SessionRow({
  metrics,
  theme,
  session,
  now,
}: {
  metrics: HudMetrics;
  theme: HudTheme;
  session: AgentSession;
  now: Date;
}): ReactElement {
  const state = session.confirmed === false ? "idle" : session.state;
  const color = sessionStateColor(state, theme);
  const word =
    session.confirmed === false
      ? COPY.sessionUnknown
      : session.state === "busy"
        ? COPY.sessionBusy
        : session.state === "waiting"
          ? COPY.sessionWaiting
          : COPY.sessionIdle;
  // While blocked, what it is blocked on matters more than where it lives.
  const detail =
    session.state === "waiting" && session.waitingFor
      ? session.waitingFor
      : session.detail;
  const line = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: metrics.cardResetGap,
    height: metrics.cardTextLine,
    lineHeight: `${metrics.cardTextLine}px`,
    fontSize: metrics.cardLabelSize,
    whiteSpace: "nowrap",
  } as const;
  const clip = { overflow: "hidden", textOverflow: "ellipsis" } as const;
  return (
    <div
      data-session={session.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: metrics.cardBucketGap,
      }}
    >
      <div style={line}>
        <span style={{ ...clip, color: theme.text }}>{session.name}</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: metrics.cardStatusGap,
            color,
            flex: "none",
          }}
        >
          <StatusRing metrics={metrics} state={state} color={color} />
          {word}
        </span>
      </div>
      <div style={{ ...line, color: theme.textMuted }}>
        <span style={clip}>{detail}</span>
        <span style={{ flex: "none" }}>
          {formatElapsed(new Date(session.since), now)}
        </span>
      </div>
    </div>
  );
}

/**
 * The live sessions for this provider, under a rule that separates them from
 * the limit windows above — they answer a different question. Only as many as
 * the card's budgeted height can hold; the rest are counted rather than drawn.
 */
function SessionList({
  metrics,
  theme,
  sessions,
  now,
}: {
  metrics: HudMetrics;
  theme: HudTheme;
  sessions: AgentSession[];
  now: Date;
}): ReactElement {
  const ordered = orderSessions(sessions);
  const { rows, hidden } = sessionRowsShown(ordered.length);
  return (
    <div data-session-list="true">
      <div
        style={{
          height: metrics.cardRule,
          background: theme.barTrack,
          marginTop: metrics.cardRuleGap,
          marginBottom: metrics.cardRuleGap,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: metrics.cardSectionGap,
        }}
      >
        {ordered.slice(0, rows).map((session) => (
          <SessionRow
            key={session.id}
            metrics={metrics}
            theme={theme}
            session={session}
            now={now}
          />
        ))}
        {hidden > 0 ? (
          <Message
            metrics={metrics}
            theme={theme}
            text={`${COPY.moreSessionsPrefix}${hidden}${COPY.moreSessionsSuffix}`}
          />
        ) : null}
      </div>
    </div>
  );
}

export function UsageCard({
  metrics,
  theme = HUD_THEMES.midnight,
  snapshot,
  sessions = [],
  now,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  snapshot: UsageSnapshot;
  /** What this provider's agents are doing, listed under the readings. */
  sessions?: AgentSession[];
  now: Date;
}): ReactElement {
  const title = `${snapshot.displayName}${COPY.usageTitleSuffix}`;
  // Only worth saying when the numbers are not current. A remembered reading
  // has to be dated, or it quietly passes itself off as live.
  const readingAge =
    snapshot.status === "stale" && snapshot.staleSince
      ? formatAgo(new Date(snapshot.staleSince), now)
      : null;

  let body: ReactElement;
  if (snapshot.status === "disabled") {
    body = (
      <Message metrics={metrics} theme={theme} text={COPY.usageDisabled} />
    );
  } else if (snapshot.status === "unauthenticated") {
    body = <Message metrics={metrics} theme={theme} text={COPY.notConnected} />;
  } else if (snapshot.buckets.length === 0) {
    body = (
      <Message
        metrics={metrics}
        theme={theme}
        text={snapshot.status === "stale" ? COPY.staleData : COPY.unavailable}
      />
    );
  } else {
    body = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: metrics.cardSectionGap,
        }}
      >
        {snapshot.buckets.map((bucket) => (
          <BucketRow
            metrics={metrics}
            theme={theme}
            key={bucket.id}
            label={bucket.label}
            percentUsed={Math.round(bucket.percentUsed)}
            resetCopy={formatResetCopy(bucket.resetsAt, bucket.resetStyle, now)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-card={snapshot.providerId}
      style={{
        width: "100%",
        height: "100%",
        paddingTop: metrics.cardPaddingTop,
        paddingBottom: metrics.cardPaddingBottom,
        paddingLeft: metrics.cardPaddingX,
        paddingRight: metrics.cardPaddingX,
        color: theme.text,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: metrics.cardIconGap,
          height: metrics.cardTitleLine,
          marginBottom: metrics.cardTitleGap,
          fontSize: metrics.cardTitleSize,
          fontWeight: 400,
          letterSpacing: -0.1,
        }}
      >
        <ProviderIcon
          id={snapshot.iconId}
          color={theme.text}
          size={metrics.cardIconSize}
        />
        <span style={{ whiteSpace: "nowrap" }}>{title}</span>
        {readingAge ? (
          <span
            data-reading-age="true"
            style={{
              marginLeft: "auto",
              fontSize: metrics.cardResetSize,
              color: theme.textMuted,
              whiteSpace: "nowrap",
            }}
          >
            {readingAge}
          </span>
        ) : null}
      </div>
      {body}
      {sessions.length > 0 ? (
        <SessionList
          metrics={metrics}
          theme={theme}
          sessions={sessions}
          now={now}
        />
      ) : null}
    </div>
  );
}
