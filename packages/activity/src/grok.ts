import { basename, join } from "node:path";
import { ACTIVITY_NOTICES, type AgentSession } from "@capsule/config";
import type { ActivityHost } from "./host.ts";
import { applyLocalEvents } from "./local-events.ts";

export async function readGrokSessions(
  host: ActivityHost,
): Promise<AgentSession[]> {
  const raw = await host.readFile(
    join(host.homeDir(), ...ACTIVITY_NOTICES.grokRegistry),
  );
  let entries: unknown;
  try {
    entries = JSON.parse(raw ?? "null");
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];
  const root = join(host.homeDir(), ...ACTIVITY_NOTICES.grokSessions);
  const projects = (await host.listDir(root)).slice(
    0,
    ACTIVITY_NOTICES.maxSessions,
  );
  const sessions: AgentSession[] = [];
  for (const entry of entries.slice(0, ACTIVITY_NOTICES.maxSessions)) {
    if (!entry || typeof entry !== "object") continue;
    const { session_id: id, pid, cwd, opened_at: opened } = entry;
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(id) ||
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      typeof cwd !== "string" ||
      !(await host.isProcessAlive(pid))
    )
      continue;
    const date = new Date(opened);
    if (!Number.isFinite(date.getTime())) continue;
    const started = await host.processStartedAt(pid);
    if (started && started.getTime() > date.getTime()) continue;
    const session: AgentSession = {
      id: `grok.${id}`,
      providerId: "grok",
      name: basename(cwd),
      detail: ACTIVITY_NOTICES.statusUnknown,
      state: "idle",
      confirmed: false,
      waitingFor: null,
      since: date.toISOString(),
    };
    for (const project of projects) {
      if (project === "." || project === ".." || project.includes("/"))
        continue;
      const path = join(root, project, id, ACTIVITY_NOTICES.eventsFile);
      if (!(await host.modifiedAt(path))) continue;
      const found = applyLocalEvents(
        session,
        (await host.readTail?.(path, ACTIVITY_NOTICES.tailBytes)) ?? null,
      );
      found.detail = found.confirmed
        ? ACTIVITY_NOTICES.localActivity
        : ACTIVITY_NOTICES.statusUnknown;
      sessions.push(found);
      break;
    }
    if (!sessions.some((s) => s.id === session.id)) sessions.push(session);
  }
  return sessions;
}
