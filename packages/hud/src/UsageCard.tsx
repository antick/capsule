import {
  COPY,
  HUD,
  SEVERITY_COLORS,
  severityForPercent,
  type UsageSnapshot,
} from "@capsule/config";
import { formatResetCopy } from "@capsule/dates";
import type { ReactElement } from "react";
import { ProviderIcon } from "./icons.tsx";

function BucketRow({
  label,
  percentUsed,
  resetCopy,
}: {
  label: string;
  percentUsed: number;
  resetCopy: string;
}): ReactElement {
  const color = SEVERITY_COLORS[severityForPercent(percentUsed)];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, color: HUD.text }}>{label}</span>
        <span style={{ fontSize: 11, color: HUD.textMuted }}>{resetCopy}</span>
      </div>
      <div
        style={{
          height: 4,
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
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: HUD.text }}>
        {percentUsed}
        {COPY.percentUsedSuffix}
      </span>
    </div>
  );
}

export function UsageCard({
  snapshot,
  now,
}: {
  snapshot: UsageSnapshot;
  now: Date;
}): ReactElement {
  const title = `${snapshot.displayName}${COPY.usageTitleSuffix}`;

  let body: ReactElement;
  if (snapshot.status === "unauthenticated") {
    body = (
      <p style={{ margin: 0, fontSize: 12, color: HUD.textMuted }}>
        {COPY.notConnected}
      </p>
    );
  } else if (snapshot.buckets.length === 0) {
    body = (
      <p style={{ margin: 0, fontSize: 12, color: HUD.textMuted }}>
        {snapshot.status === "stale" ? COPY.staleData : COPY.unavailable}
      </p>
    );
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {snapshot.status === "stale" ? (
          <p style={{ margin: 0, fontSize: 11, color: HUD.textMuted }}>
            {COPY.staleData}
          </p>
        ) : null}
        {snapshot.buckets.map((bucket) => (
          <BucketRow
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
        width: HUD.cardWidth,
        padding: HUD.cardPadding,
        color: HUD.text,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <ProviderIcon id={snapshot.iconId} color={HUD.text} size={14} />
        <span>{title}</span>
      </div>
      {body}
    </div>
  );
}
