import {
  COPY,
  HUD,
  type HudMetrics,
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
  label,
  percentUsed,
  resetCopy,
}: {
  metrics: HudMetrics;
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
        <span style={{ fontSize: metrics.cardLabelSize, color: HUD.text }}>
          {label}
        </span>
        <span style={{ fontSize: metrics.cardResetSize, color: HUD.textMuted }}>
          {resetCopy}
        </span>
      </div>
      <div
        style={{
          height: metrics.barHeight,
          borderRadius: 99,
          background: HUD.barTrack,
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
          color: HUD.text,
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
  text,
}: {
  metrics: HudMetrics;
  text: string;
}): ReactElement {
  return (
    <p
      style={{
        margin: 0,
        fontSize: metrics.cardLabelSize,
        color: HUD.textMuted,
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
  snapshot,
  now,
}: {
  metrics: HudMetrics;
  snapshot: UsageSnapshot;
  now: Date;
}): ReactElement {
  const title = `${snapshot.displayName}${COPY.usageTitleSuffix}`;

  let body: ReactElement;
  if (snapshot.status === "unauthenticated") {
    body = <Message metrics={metrics} text={COPY.notConnected} />;
  } else if (snapshot.buckets.length === 0) {
    body = (
      <Message
        metrics={metrics}
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
        color: HUD.text,
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
          color={HUD.text}
          size={metrics.cardIconSize}
        />
        <span>{title}</span>
      </div>
      {body}
    </div>
  );
}
