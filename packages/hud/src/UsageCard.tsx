import {
  COPY,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  MOTION,
  SEVERITY_COLORS,
  severityForPercent,
  type UsageSnapshot,
} from "@capsule/config";
import { formatResetCopy } from "@capsule/dates";
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

export function UsageCard({
  metrics,
  theme = HUD_THEMES.midnight,
  snapshot,
  now,
}: {
  metrics: HudMetrics;
  theme?: HudTheme;
  snapshot: UsageSnapshot;
  now: Date;
}): ReactElement {
  const title = `${snapshot.displayName}${COPY.usageTitleSuffix}`;

  let body: ReactElement;
  if (snapshot.status === "unauthenticated") {
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
        <span>{title}</span>
      </div>
      {body}
    </div>
  );
}
