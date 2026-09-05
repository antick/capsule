import { join } from "node:path";
import { ACTIVITY, type AgentSession, COPY } from "@capsule/config";
import type { ActivityHost } from "./host.ts";

/**
 * One entry in `~/.claude/sessions/<pid>.json`, as Claude Code writes it, with
 * the two things only this monitor needs: the pid and the process start time
 * used to tell a live session from a file a crashed one left behind.
 */
export interface ClaudeSessionRecord {
  pid: number;
  startedAt: Date | null;
  session: AgentSession;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Which surface a session is running in, for the card's second line. */
export function surfaceLabel(entrypoint: string | null): string {
  switch (entrypoint) {
    case "claude-desktop":
    case "claude-desktop-3p":
      return COPY.surfaceDesktop;
    case "claude-vscode":
      return COPY.surfaceVsCode;
    case "local-agent":
      return COPY.surfaceAgent;
    default:
      return COPY.surfaceTerminal;
  }
}

/**
 * `procStart` looks like "Fri Aug 28 05:15:20 2026": a ctime string, in UTC,
 * with the day of month space-padded on single-digit days.
 */
export function parseProcStart(text: string): Date | null {
  const collapsed = text.trim().split(/\s+/);
  if (collapsed.length !== 5) {
    return null;
  }
  const [, month, day, clock, year] = collapsed;
  const parsed = new Date(`${day} ${month} ${year} ${clock} UTC`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Decoded leniently on purpose: the file is written by another program on its
 * own release schedule, and an unknown field must never cost us a session we
 * could have shown.
 */
export function parseClaudeSession(
  raw: unknown,
  now: Date,
): ClaudeSessionRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const json = raw as Record<string, unknown>;
  const pid = asNumber(json.pid);
  const cwd = asString(json.cwd);
  if (pid === null || cwd === null) {
    return null;
  }
  const tempo = asString(json.tempo);
  const status = asString(json.status);
  const state: AgentSession["state"] =
    tempo === "blocked" || status === "waiting"
      ? "waiting"
      : tempo === "active" || status === "busy"
        ? "busy"
        : "idle";
  const sinceMs = asNumber(json.statusUpdatedAt) ?? asNumber(json.updatedAt);
  const startedMs = asNumber(json.startedAt);
  const procStart = asString(json.procStart);
  const folder = cwd.split("/").filter(Boolean).at(-1) ?? cwd;
  return {
    pid,
    startedAt:
      startedMs !== null
        ? new Date(startedMs)
        : procStart
          ? parseProcStart(procStart)
          : null,
    session: {
      id: `claude.${pid}`,
      providerId: "claude",
      name: asString(json.name) ?? folder,
      detail: `${surfaceLabel(asString(json.entrypoint))} · ${folder}`,
      state,
      waitingFor: asString(json.waitingFor) ?? asString(json.needs),
      since: (sinceMs !== null ? new Date(sinceMs) : now).toISOString(),
    },
  };
}

/**
 * Is the process behind a record still running, and is it still the same
 * process? A crashed session leaves its file saying `busy` forever, and on a
 * long-running machine pids get reused, so the start times are compared too.
 */
export async function isRecordAlive(
  host: ActivityHost,
  record: ClaudeSessionRecord,
): Promise<boolean> {
  if (!(await host.isProcessAlive(record.pid))) {
    return false;
  }
  if (!record.startedAt) {
    return true;
  }
  const actual = await host.processStartedAt(record.pid);
  if (!actual) {
    // Cannot prove it either way; trust the pid rather than hide a session
    // that is probably real.
    return true;
  }
  return (
    Math.abs(actual.getTime() - record.startedAt.getTime()) <
    ACTIVITY.pidReuseToleranceMs
  );
}

export function claudeSessionsDir(host: ActivityHost): string {
  return join(host.homeDir(), ...ACTIVITY.claudeSessionsDirSegments);
}

/** The Claude Code sessions actually running right now, newest first. */
export async function readClaudeSessions(
  host: ActivityHost,
): Promise<AgentSession[]> {
  const dir = claudeSessionsDir(host);
  const names = (await host.listDir(dir)).filter((n) => n.endsWith(".json"));
  const now = host.now();
  const found: AgentSession[] = [];
  for (const name of names) {
    const raw = await host.readFile(join(dir, name));
    if (!raw) {
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    const record = parseClaudeSession(json, now);
    if (record && (await isRecordAlive(host, record))) {
      found.push(record.session);
    }
  }
  return found.sort((a, b) => b.since.localeCompare(a.since));
}
