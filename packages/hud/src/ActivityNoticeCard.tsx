import {
  ACTIVITY_NOTICES,
  type ActivityNotice,
  COPY,
  type HudMetrics,
  type HudTheme,
  type UsageSnapshot,
} from "@capsule/config";
import { formatAgo } from "@capsule/dates";
import type { ReactElement } from "react";
import { CardAction } from "./CardAction.tsx";
import { ProviderIcon } from "./icons.tsx";

export function ActivityNoticeCard({
  notices,
  snapshot,
  metrics: m,
  theme,
  now,
  onDismiss,
  onClearAll,
}: {
  notices: ActivityNotice[];
  snapshot: UsageSnapshot;
  metrics: HudMetrics;
  theme: HudTheme;
  now: Date;
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
}): ReactElement {
  const waiting = notices.filter((notice) => notice.kind === "waiting").length;
  const completed = notices.length - waiting;
  const shown = [...notices].reverse();
  const hidden = Math.max(0, notices.length - ACTIVITY_NOTICES.maxVisible);
  return (
    <div
      data-activity-notices={snapshot.providerId}
      role="status"
      aria-live="polite"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: `${m.cardPaddingTop}px ${m.cardPaddingX}px ${m.cardPaddingBottom}px`,
        color: theme.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: m.cardIconGap,
          height: m.cardTitleLine,
          marginBottom: m.cardTitleGap,
          fontSize: m.cardTitleSize,
        }}
      >
        <ProviderIcon
          id={snapshot.iconId}
          color={theme.text}
          size={m.cardIconSize}
        />
        <span>
          {snapshot.displayName}
          {COPY.activityTitleSuffix}
        </span>
        {onClearAll ? (
          <CardAction
            metrics={m}
            theme={theme}
            label={COPY.noticeClearAllLabel}
            onClick={onClearAll}
          >
            {COPY.noticeClearAll}
          </CardAction>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          gap: m.cardResetGap,
          height: m.cardTextLine,
          lineHeight: `${m.cardTextLine}px`,
          fontSize: m.cardResetSize,
        }}
      >
        {waiting > 0 ? (
          <span
            style={{ color: ACTIVITY_NOTICES.waitingColor[theme.appearance] }}
          >
            {waiting} {COPY.noticeWaiting}
          </span>
        ) : null}
        {completed > 0 ? (
          <span
            style={{ color: ACTIVITY_NOTICES.completedColor[theme.appearance] }}
          >
            {completed} {COPY.noticeCompletedShort}
          </span>
        ) : null}
      </div>
      <div
        style={{
          height: m.cardRule,
          background: theme.barTrack,
          marginTop: m.cardRuleGap,
          marginBottom: m.cardRuleGap,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: m.cardSectionGap,
          maxHeight:
            ACTIVITY_NOTICES.maxVisible *
              (m.cardTextLine * 2 + m.cardBucketGap) +
            (ACTIVITY_NOTICES.maxVisible - 1) * m.cardSectionGap,
          overflowY: "auto",
        }}
      >
        {shown.map((notice) => {
          const color =
            notice.kind === "waiting"
              ? ACTIVITY_NOTICES.waitingColor[theme.appearance]
              : ACTIVITY_NOTICES.completedColor[theme.appearance];
          const label =
            notice.kind === "waiting"
              ? COPY.noticeWaiting
              : COPY.noticeCompleted;
          return (
            <div
              key={notice.id}
              data-notice={notice.kind}
              style={{
                display: "flex",
                flexShrink: 0,
                alignItems: "center",
                gap: m.cardResetGap,
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: m.cardBucketGap,
                }}
              >
                <span
                  title={notice.title}
                  style={{
                    fontSize: m.cardLabelSize,
                    lineHeight: `${m.cardTextLine}px`,
                    height: m.cardTextLine,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {notice.title}
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: m.cardResetGap,
                    fontSize: m.cardResetSize,
                    lineHeight: `${m.cardTextLine}px`,
                    height: m.cardTextLine,
                  }}
                >
                  <span
                    title={notice.summary || label}
                    style={{
                      color,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {notice.summary || label}
                  </span>
                  <span
                    style={{
                      color: theme.textMuted,
                      flex: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatAgo(new Date(notice.at), now)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`${COPY.noticeDismiss}: ${notice.title}`}
                title={COPY.noticeDismiss}
                data-hud-hit="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onDismiss?.(notice.id);
                }}
                style={{
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  width: m.cardTitleLine,
                  height: m.cardTitleLine,
                  padding: 0,
                  border: 0,
                  borderRadius: m.cardStatusGap,
                  background: theme.barTrack,
                  color: theme.textMuted,
                  cursor: "pointer",
                  fontSize: m.cardTitleSize,
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          );
        })}
        {hidden > 0 ? (
          <span
            style={{
              fontSize: m.cardResetSize,
              color: theme.textMuted,
              height: m.cardTextLine,
              lineHeight: `${m.cardTextLine}px`,
            }}
          >
            +{hidden} {COPY.noticeMore}
          </span>
        ) : null}
      </div>
    </div>
  );
}
