import { join } from "node:path";
import { ACTIVITY, type AgentSession, COPY } from "@capsule/config";
import type { ActivityHost } from "./host.ts";

/** Somewhere Codex recorded work, and when it last did. */
export interface CodexCandidate {
  id: string;
  name: string;
  at: Date;
}

/**
 * Codex publishes no status field. What it does do is append to a thread's
 * rollout while a turn runs, so a rollout written moments ago means work is
 * happening now. That is a heuristic, and it errs short: the ring stops
 * `staleAfterMs` after the last write rather than claim activity it cannot
 * see.
 */
export function codexSessionFrom(
  candidates: readonly CodexCandidate[],
  now: Date,
  staleAfterMs: number = ACTIVITY.codexStaleAfterMs,
): AgentSession | null {
  const newest = candidates.reduce<CodexCandidate | null>(
    (best, item) => (!best || item.at > best.at ? item : best),
    null,
  );
  if (!newest || now.getTime() - newest.at.getTime() > staleAfterMs) {
    return null;
  }
  return {
    id: newest.id,
    providerId: "codex",
    name: newest.name,
    detail: COPY.sessionWorkingDetail,
    state: "busy",
    waitingFor: null,
    since: newest.at.toISOString(),
  };
}

const ROLLOUTS_SQL =
  "SELECT rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at_ms DESC LIMIT 8";
const DESKTOP_SQL =
  "SELECT source_updated_at, display_title FROM local_thread_catalog ORDER BY source_updated_at DESC LIMIT 1";

function expandHome(path: string, home: string): string {
  return path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

/**
 * The rollout of the most recently touched thread, from Codex's own index.
 * Falls back to the newest file in the newest day folders when the index
 * cannot be read: the sessions tree holds thousands of files, but only the
 * last couple of days can hold a rollout that is still being written to.
 */
export async function newestRollout(
  host: ActivityHost,
): Promise<{ path: string; at: Date } | null> {
  const home = host.homeDir();
  const rows = await host.query(
    join(home, ...ACTIVITY.codexStateDbSegments),
    ROLLOUTS_SQL,
  );
  for (const row of rows) {
    const path = row[0];
    if (!path) {
      continue;
    }
    const at = await host.modifiedAt(expandHome(path, home));
    if (at) {
      return { path, at };
    }
  }
  return newestRolloutOnDisk(host);
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

/**
 * Both surfaces, because "Codex" is two programs that record their work in
 * different places: the CLI and the VS Code extension append to a rollout, and
 * the desktop app writes to its own catalogue. Whichever moved last is the one
 * that is working.
 */
export async function readCodexSessions(
  host: ActivityHost,
): Promise<AgentSession[]> {
  const candidates: CodexCandidate[] = [];
  const rollout = await newestRollout(host);
  if (rollout) {
    candidates.push({
      id: `codex.${rollout.path.split("/").at(-1) ?? rollout.path}`,
      name: "Codex",
      at: rollout.at,
    });
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
      name: row[1] && row[1].length > 0 ? row[1] : "Codex",
      at: new Date(seconds * 1000),
    });
  }
  const session = codexSessionFrom(candidates, host.now());
  return session ? [session] : [];
}
