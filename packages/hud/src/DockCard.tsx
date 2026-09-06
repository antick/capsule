import {
  ACTIVITY_NOTICES,
  type ActivityNotice,
  type AgentSession,
  cardHeightFor,
  type HudMetrics,
  type HudTheme,
  MOTION,
  type UsageSnapshot,
} from "@capsule/config";
import type { ReactElement } from "react";
import { ActivityNoticeCard } from "./ActivityNoticeCard.tsx";
import { UsageCard } from "./UsageCard.tsx";

export function dockCardHeight(
  metrics: HudMetrics,
  snapshot: UsageSnapshot | null,
  sessions: number,
  notices: number,
): number {
  const count = snapshot?.buckets.length ?? 0;
  const buckets =
    snapshot?.status === "unauthenticated" || snapshot?.status === "disabled"
      ? 0
      : count;
  if (notices > 0) {
    return (
      cardHeightFor(metrics, {
        buckets: 0,
        sessions: Math.min(notices, ACTIVITY_NOTICES.maxVisible),
      }) +
      (notices > ACTIVITY_NOTICES.maxVisible
        ? metrics.cardSectionGap + metrics.cardTextLine
        : 0)
    );
  }
  return cardHeightFor(metrics, { buckets, sessions });
}

export function DockCard({
  snapshot,
  sessions,
  notices,
  metrics,
  theme,
  now,
  onPointerEnter,
  onPointerLeave,
  onDismissNotice,
}: {
  snapshot: UsageSnapshot;
  sessions: AgentSession[];
  notices: ActivityNotice[];
  metrics: HudMetrics;
  theme: HudTheme;
  now: Date;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onDismissNotice?: (id: string) => void;
}): ReactElement {
  return (
    <div
      key={`${snapshot.providerId}-${notices.length > 0 ? "notices" : "usage"}`}
      style={{
        width: "100%",
        height: "100%",
        animation: `capsule-crossfade ${MOTION.crossfadeMs}ms ease-in-out`,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {notices.length > 0 ? (
        <ActivityNoticeCard
          snapshot={snapshot}
          notices={notices}
          metrics={metrics}
          theme={theme}
          now={now}
          onDismiss={onDismissNotice}
        />
      ) : (
        <UsageCard
          snapshot={snapshot}
          sessions={sessions}
          metrics={metrics}
          theme={theme}
          now={now}
        />
      )}
    </div>
  );
}
