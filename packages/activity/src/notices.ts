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
    dismiss: (id: string) => {
      notices = notices.filter((item) => item.id !== id);
      return notices;
    },
    update: (activity: ActivityByProvider): ActivityNotice[] => {
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
        if (new Date(evidence.at).getTime() < startedAt.getTime()) continue;
        notices.push({
          id,
          sessionId: session.id,
          providerId: session.providerId,
          title: session.name.slice(0, ACTIVITY_NOTICES.maxTitleLength),
          kind: evidence.kind,
          at: evidence.at,
        });
      }
      notices = notices.slice(-ACTIVITY_NOTICES.maxPending);
      return notices;
    },
  };
}
