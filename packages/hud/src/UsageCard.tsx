import {
  COPY,
  HUD,
  MOTION,
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: HUD.cardBucketGap,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: HUD.cardResetGap,
          height: HUD.cardTextLine,
          lineHeight: `${HUD.cardTextLine}px`,
        }}
      >
        <span style={{ fontSize: HUD.cardLabelSize, color: HUD.text }}>
          {label}
        </span>
        <span style={{ fontSize: HUD.cardResetSize, color: HUD.textMuted }}>
          {resetCopy}
        </span>
      </div>
      <div
        style={{
          height: HUD.barHeight,
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
          fontSize: HUD.cardLabelSize,
          color: HUD.text,
          height: HUD.cardTextLine,
          lineHeight: `${HUD.cardTextLine}px`,
        }}
      >
        {percentUsed}
        {COPY.percentUsedSuffix}
      </span>
    </div>
  );
}

function Message({ text }: { text: string }): ReactElement {
  return (
    <p
      style={{
        margin: 0,
        fontSize: HUD.cardLabelSize,
        color: HUD.textMuted,
        height: HUD.cardTextLine,
        lineHeight: `${HUD.cardTextLine}px`,
      }}
    >
      {text}
    </p>
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
    body = <Message text={COPY.notConnected} />;
  } else if (snapshot.buckets.length === 0) {
    body = (
      <Message
        text={snapshot.status === "stale" ? COPY.staleData : COPY.unavailable}
      />
    );
  } else {
    body = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: HUD.cardSectionGap,
        }}
      >
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
        width: "100%",
        height: "100%",
        paddingTop: HUD.cardPaddingTop,
        paddingBottom: HUD.cardPaddingBottom,
        paddingLeft: HUD.cardPaddingX,
        paddingRight: HUD.cardPaddingX,
        color: HUD.text,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: HUD.cardIconGap,
          height: HUD.cardTitleLine,
          marginBottom: HUD.cardTitleGap,
          fontSize: HUD.cardTitleSize,
          fontWeight: 400,
          letterSpacing: -0.1,
        }}
      >
        <ProviderIcon
          id={snapshot.iconId}
          color={HUD.text}
          size={HUD.cardIconSize}
        />
        <span>{title}</span>
      </div>
      {body}
    </div>
  );
}
