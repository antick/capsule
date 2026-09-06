import { join } from "node:path";
import {
  ACTIVITY,
  ACTIVITY_NOTICES,
  AGENTS,
  type AgentSession,
  CODEX_ACTIVITY_COPY,
  PROVIDER_LABELS,
} from "@capsule/config";
import type { ActivityHost } from "./host.ts";
import { applyLocalEvents } from "./local-events.ts";

/** Somewhere Codex recorded work, and when it last did. */
export interface CodexCandidate {
  id: string;
  name: string;
  at: Date;
}

/**
 * A recent rollout write is an activity hint, not proof a turn is running.
 * Keep the ring's existing signal, and explicitly label its uncertainty.
 */
export function codexSessionFrom(
  candidates: readonly CodexCandidate[],
  now: Date,
  staleAfterMs: number = ACTIVITY.codexStaleAfterMs,
): AgentSession | null {
  const newest = candidates.reduce<CodexCandidate | null>(
    (best, item) =>
      Number.isFinite(item.at.getTime()) && (!best || item.at > best.at)
        ? item
        : best,
    null,
  );
  if (!newest || now.getTime() - newest.at.getTime() > staleAfterMs) {
    return null;
  }
  return {
    id: newest.id,
    providerId: "codex",
    name: newest.name,
    detail: CODEX_ACTIVITY_COPY.recent,
    state: "busy",
    confirmed: false,
    waitingFor: null,
    since: newest.at.toISOString(),
  };
}

const ROLLOUTS_SQL = `SELECT id, title, rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at_ms DESC LIMIT ${AGENTS.maxSessions}`;
const DESKTOP_SQL =
  "SELECT source_updated_at, display_title FROM local_thread_catalog ORDER BY source_updated_at DESC LIMIT 1";

function expandHome(path: string, home: string): string {
  return path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

async function indexedRollouts(
  host: ActivityHost,
): Promise<(CodexCandidate & { path: string })[]> {
  const home = host.homeDir();
  const rows = await host.query(
    join(home, ...ACTIVITY.codexStateDbSegments),
    ROLLOUTS_SQL,
  );
  const candidates = new Map<string, CodexCandidate & { path: string }>();
  for (const row of rows.slice(0, AGENTS.maxSessions)) {
    const [threadId, title, path] = row;
    if (!path) {
      continue;
    }
    const at = await host.modifiedAt(expandHome(path, home));
    if (at && Number.isFinite(at.getTime())) {
      const id = `codex.${threadId || path.split("/").at(-1) || path}`;
      const previous = candidates.get(id);
      if (!previous || at > previous.at) {
        candidates.set(id, {
          id,
          name: title?.trim() ? title : PROVIDER_LABELS.codex,
          path,
          at,
        });
      }
    }
  }
  return [...candidates.values()];
}

/** Newest indexed rollout, with a bounded directory scan if the index is unavailable. */
export async function newestRollout(
  host: ActivityHost,
): Promise<{ path: string; at: Date } | null> {
  const candidates = await indexedRollouts(host);
  const newest = candidates.reduce<(typeof candidates)[number] | null>(
    (best, candidate) => (!best || candidate.at > best.at ? candidate : best),
    null,
  );
  return newest
    ? { path: newest.path, at: newest.at }
    : newestRolloutOnDisk(host);
}

async function newestOf(
  host: ActivityHost,
  dir: string,
  take: number,
): Promise<string[]> {
  const names = await host.listDir(dir);
  return names
    .filter((name) => !name.startsWith("."))
    .sort()
    .reverse()
    .slice(0, take);
}

async function newestRolloutOnDisk(
  host: ActivityHost,
): Promise<{ path: string; at: Date } | null> {
  const root = join(host.homeDir(), ...ACTIVITY.codexSessionsDirSegments);
  let best: { path: string; at: Date } | null = null;
  let daysSeen = 0;
  for (const year of await newestOf(host, root, 1)) {
    for (const month of await newestOf(host, join(root, year), 2)) {
      for (const day of await newestOf(
        host,
        join(root, year, month),
        ACTIVITY.codexRecentDays,
      )) {
        if (daysSeen >= ACTIVITY.codexRecentDays) {
          return best;
        }
        daysSeen += 1;
        const folder = join(root, year, month, day);
        for (const name of await host.listDir(folder)) {
          if (!name.endsWith(".jsonl")) {
            continue;
          }
          const path = join(folder, name);
          const at = await host.modifiedAt(path);
          if (at && (!best || at > best.at)) {
            best = { path, at };
          }
        }
      }
    }
  }
  return best;
}

/** Keep individual rollout identities; a desktop catalogue update cannot identify their activity. */
export async function readCodexSessions(
  host: ActivityHost,
): Promise<AgentSession[]> {
  const candidates: (CodexCandidate & { path?: string })[] =
    await indexedRollouts(host);
  if (candidates.length === 0) {
    const rollout = await newestRolloutOnDisk(host);
    if (rollout) {
      candidates.push({
        id: `codex.${rollout.path.split("/").at(-1) ?? rollout.path}`,
        name: PROVIDER_LABELS.codex,
        at: rollout.at,
        path: rollout.path,
      });
    }
  }
  if (candidates.length > 0) {
    const now = host.now();
    const sessions: AgentSession[] = [];
    for (const candidate of candidates) {
      const fresh = codexSessionFrom([candidate], now);
      if (!fresh && !host.readTail) continue;
      const fallback = codexSessionFrom([candidate], candidate.at);
      if (!fallback) continue;
      const parsed = applyLocalEvents(
        fresh ?? fallback,
        candidate.path
          ? ((await host.readTail?.(
              expandHome(candidate.path, host.homeDir()),
              ACTIVITY_NOTICES.tailBytes,
            )) ?? null)
          : null,
      );
      if (
        fresh ||
        (parsed.confirmed &&
          now.getTime() - candidate.at.getTime() <=
            ACTIVITY_NOTICES.activeEvidenceMs)
      )
        sessions.push(parsed);
      else if (parsed.state === "waiting")
        sessions.push({
          ...parsed,
          confirmed: false,
          detail: ACTIVITY_NOTICES.statusUnknown,
        });
    }
    return sessions;
  }
  const desktop = await host.query(
    join(host.homeDir(), ...ACTIVITY.codexDesktopDbSegments),
    DESKTOP_SQL,
  );
  const row = desktop[0];
  const seconds = row ? Number(row[0]) : Number.NaN;
  if (row && Number.isFinite(seconds)) {
    // Seconds since the epoch with a fractional part, not the milliseconds
    // the thread index next door uses.
    candidates.push({
      id: "codex.desktop",
      name: row[1] && row[1].length > 0 ? row[1] : PROVIDER_LABELS.codex,
      at: new Date(seconds * 1000),
    });
  }
  const session = codexSessionFrom(candidates, host.now());
  return session ? [session] : [];
}
