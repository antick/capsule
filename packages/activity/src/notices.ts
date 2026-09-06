import {
  ACTIVITY_NOTICES,
  type ActivityByProvider,
  type ActivityNotice,
} from "@capsule/config";

/** One process lifetime: baseline silently, then emit each explicit transition once. */
export function createNoticeTracker(startedAt: Date = new Date()) {
  let notices: ActivityNotice[] = [];
  const seen = new Set<string>();
  const remember = (id: string) => {
    seen.add(id);
    while (seen.size > ACTIVITY_NOTICES.maxSeen)
      seen.delete(seen.values().next().value as string);
  };
  return {
    get: () => notices,
    markRead: (ids: string[]) => {
      const opened = new Set(ids);
      notices = notices.map((item) =>
        opened.has(item.id) ? { ...item, read: true } : item,
      );
      return notices;
    },
    dismiss: (id: string) => {
      notices = notices.filter((item) => item.id !== id);
      return notices;
    },
    update: (activity: ActivityByProvider, now?: Date): ActivityNotice[] => {
      const sessions = Object.values(activity).flatMap((items) => items ?? []);
      notices = notices.filter(
        (notice) =>
          notice.kind !== "waiting" ||
          sessions.some(
            (s) =>
              s.id === notice.sessionId &&
              s.state === "waiting" &&
              s.since === notice.at,
          ),
      );
      notices = notices.map((notice) =>
        notice.kind === "completed" &&
        sessions.some(
          (s) =>
            s.id === notice.sessionId &&
            s.state !== "idle" &&
            Date.parse(s.since) > Date.parse(notice.at),
        )
          ? { ...notice, read: true }
          : notice,
      );
      for (const session of sessions) {
        const evidence =
          session.state === "waiting" && session.confirmed !== false
            ? {
                kind: "waiting" as const,
                at: session.since,
                id: `waiting:${session.since}`,
              }
            : session.completion
              ? { kind: "completed" as const, ...session.completion }
              : null;
        if (!evidence || !Number.isFinite(new Date(evidence.at).getTime()))
          continue;
        const id = `${session.id}:${evidence.id}`;
        if (seen.has(id)) continue;
        remember(id);
        const age = now ? now.getTime() - new Date(evidence.at).getTime() : 0;
        if (
          new Date(evidence.at).getTime() < startedAt.getTime() ||
          age < 0 ||
          age > ACTIVITY_NOTICES.maxEventAgeMs
        )
          continue;
        notices.push({
          id,
          sessionId: session.id,
          providerId: session.providerId,
          title: session.name.slice(0, ACTIVITY_NOTICES.maxTitleLength),
          kind: evidence.kind,
          at: evidence.at,
          summary:
            evidence.kind === "completed"
              ? session.completion?.summary
              : (session.waitingFor ?? undefined),
        });
      }
      notices = notices.slice(-ACTIVITY_NOTICES.maxPending);
      return notices;
    },
  };
}
