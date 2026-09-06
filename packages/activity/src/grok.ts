import { basename, join } from "node:path";
import { ACTIVITY, ACTIVITY_NOTICES, type AgentSession } from "@capsule/config";
import type { ActivityHost } from "./host.ts";
import { applyLocalEvents } from "./local-events.ts";

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);

export async function readGrokSessions(
  host: ActivityHost,
): Promise<AgentSession[]> {
  const root = join(host.homeDir(), ...ACTIVITY_NOTICES.grokSessions);
  const registered = new Map<string, AgentSession>();
  let entries: unknown;
  try {
    entries = JSON.parse(
      (await host.readFile(
        join(host.homeDir(), ...ACTIVITY_NOTICES.grokRegistry),
      )) ?? "null",
    );
  } catch {
    entries = [];
  }
  for (const entry of (Array.isArray(entries) ? entries : []).slice(
    0,
    ACTIVITY_NOTICES.maxSessions,
  )) {
    if (!entry || typeof entry !== "object") continue;
    const { session_id: id, pid, cwd, opened_at: opened } = entry;
    if (
      !validId(id) ||
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      typeof cwd !== "string" ||
      !(await host.isProcessAlive(pid))
    )
      continue;
    const date = new Date(opened);
    if (!Number.isFinite(date.getTime())) continue;
    const started = await host.processStartedAt(pid);
    if (
      started &&
      started.getTime() - date.getTime() > ACTIVITY.pidReuseToleranceMs
    )
      continue;
    registered.set(id, {
      id: `grok.${id}`,
      providerId: "grok",
      name: basename(cwd),
      detail: ACTIVITY_NOTICES.statusUnknown,
      state: "idle",
      confirmed: false,
      waitingFor: null,
      since: date.toISOString(),
    });
  }
  const sessions = new Map<string, AgentSession>();
  // Recent event files cover current CLI versions that do not update the active-session registry.
  for (const project of (await host.listDir(root)).slice(
    0,
    ACTIVITY_NOTICES.maxSessions,
  )) {
    if (project === "." || project === ".." || project.includes("/")) continue;
    const folder = join(root, project);
    const ids = new Set([
      ...registered.keys(),
      ...(await host.listDir(folder))
        .filter(validId)
        .sort()
        .reverse()
        .slice(0, ACTIVITY_NOTICES.maxSessions),
    ]);
    for (const id of ids) {
      const path = join(folder, id, ACTIVITY_NOTICES.eventsFile);
      const modified = await host.modifiedAt(path);
      if (!modified) continue;
      const known = registered.get(id);
      if (
        !known &&
        host.now().getTime() - modified.getTime() >
          ACTIVITY_NOTICES.activeEvidenceMs
      )
        continue;
      const base: AgentSession = known ?? {
        id: `grok.${id}`,
        providerId: "grok",
        name: project,
        detail: ACTIVITY_NOTICES.statusUnknown,
        state: "idle",
        confirmed: false,
        waitingFor: null,
        since: modified.toISOString(),
      };
      const found = applyLocalEvents(
        base,
        (await host.readTail?.(path, ACTIVITY_NOTICES.tailBytes)) ?? null,
      );
      try {
        const summary = JSON.parse(
          (await host.readFile(
            join(folder, id, ACTIVITY_NOTICES.grokSummaryFile),
          )) ?? "null",
        );
        if (typeof summary?.generated_title === "string")
          found.name = summary.generated_title.slice(
            0,
            ACTIVITY_NOTICES.maxTitleLength,
          );
      } catch {
        /* A partially written title must not hide activity. */
      }
      sessions.set(id, found);
    }
  }
  for (const [id, session] of registered)
    if (!sessions.has(id)) sessions.set(id, session);
  return [...sessions.values()]
    .sort((a, b) => b.since.localeCompare(a.since))
    .slice(0, ACTIVITY_NOTICES.maxSessions);
}
