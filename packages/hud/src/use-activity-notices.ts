import {
  ACTIVITY_NOTICES,
  type ActivityNotice,
  type ProviderId,
} from "@capsule/config";
import { useEffect, useRef, useState } from "react";

const NO_NOTICES: ActivityNotice[] = [];

/** The host owns notices; this only owns their temporary presentation. */
export function useActivityNotices(
  notices: ActivityNotice[] = NO_NOTICES,
  pointerInside: boolean | null,
  autoPopups = true,
  onRead?: (ids: string[]) => void,
) {
  const [providerId, setProviderId] = useState<ProviderId | null>(
    autoPopups
      ? (notices.filter((n) => !n.read).at(-1)?.providerId ?? null)
      : null,
  );
  const readRef = useRef(onRead);
  readRef.current = onRead;
  const [hovered, setHovered] = useState(false);
  const seen = useRef(new Set<string>());
  const remaining = useRef<number>(ACTIVITY_NOTICES.visibleMs);
  const [revision, setRevision] = useState(0);
  const timedRevision = useRef(-1);
  const visible = notices.filter((notice) => notice.providerId === providerId);
  const key = visible.map((notice) => notice.id).join("\n");

  useEffect(() => {
    const fresh = notices.filter(
      (notice) => !seen.current.has(notice.id) && !notice.read,
    );
    seen.current = new Set(notices.map((notice) => notice.id));
    const newest = fresh.at(-1);
    if (newest && autoPopups) {
      setProviderId(newest.providerId);
      setRevision((value) => value + 1);
    }
  }, [notices, autoPopups]);

  useEffect(() => {
    if (!autoPopups) setProviderId(null);
  }, [autoPopups]);

  const unreadKey = visible
    .filter((n) => !n.read)
    .map((n) => n.id)
    .join("\n");
  useEffect(() => {
    if (!hovered || !unreadKey) return;
    const timer = setTimeout(
      () => readRef.current?.(unreadKey.split("\n")),
      ACTIVITY_NOTICES.readDelayMs,
    );
    return () => clearTimeout(timer);
  }, [hovered, unreadKey]);

  useEffect(() => {
    if (pointerInside === false) setHovered(false);
  }, [pointerInside]);

  useEffect(() => {
    if (timedRevision.current !== revision) {
      timedRevision.current = revision;
      remaining.current = ACTIVITY_NOTICES.visibleMs;
    }
    if (providerId === null || !key || hovered) return;
    const started = Date.now();
    const timer = setTimeout(() => {
      setProviderId(null);
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [providerId, key, hovered, revision]);

  return {
    providerId: visible.length > 0 ? providerId : null,
    visible,
    unread: notices.filter((notice) => !notice.read),
    hasFor: (id: ProviderId) =>
      notices.some((notice) => notice.providerId === id),
    waiting: notices.filter((notice) => notice.kind === "waiting"),
    countFor: (id: ProviderId) =>
      notices.filter((notice) => notice.providerId === id && !notice.read)
        .length,
    pause: () => setHovered(true),
    resume: () => setHovered(false),
    close: () => setProviderId(null),
    reopen: (id: ProviderId) => {
      if (!notices.some((notice) => notice.providerId === id)) return false;
      readRef.current?.(
        notices
          .filter((notice) => notice.providerId === id && !notice.read)
          .map((notice) => notice.id),
      );
      setProviderId(id);
      setRevision((value) => value + 1);
      return true;
    },
  };
}
