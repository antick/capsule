import type { AgentSession } from "@capsule/config";
import { expect, it } from "vitest";
import { parseClaudeSession } from "./claude.ts";
import { applyLocalEvents } from "./local-events.ts";
import { createNoticeTracker } from "./notices.ts";

const at = "2026-09-06T13:00:00Z";
const base: AgentSession = {
  id: "codex.task",
  providerId: "codex",
  name: "Task",
  detail: "",
  state: "idle",
  confirmed: false,
  since: at,
  waitingFor: null,
};
it("shows work for the current Claude registry format without status/tempo", () => {
  const record = parseClaudeSession(
    {
      pid: 52296,
      cwd: "/project",
      sessionId: "task",
      startedAt: Date.parse(at),
      entrypoint: "claude-desktop",
    },
    new Date(at),
  );
  if (!record) throw new Error("Valid registry entry was rejected");
  const current = applyLocalEvents(
    record.session,
    JSON.stringify({
      type: "assistant",
      timestamp: at,
      uuid: "tool",
      message: {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: "Read", id: "read" }],
      },
    }),
  );
  expect(current).toMatchObject({ state: "busy", confirmed: true });
});
it("clears a previous completion when the same task starts working again", () => {
  const raw = [
    {
      type: "event_msg",
      timestamp: at,
      payload: { type: "task_complete", turn_id: "old" },
    },
    {
      type: "event_msg",
      timestamp: "2026-09-06T13:01:00Z",
      payload: { type: "task_started", turn_id: "new" },
    },
  ]
    .map((row) => JSON.stringify(row))
    .join("\n");
  const current = applyLocalEvents(base, raw);
  expect(current.state).toBe("busy");
  expect(current.completion).toBeUndefined();
});
it("does not notify for a completion discovered long after it happened", () => {
  const tracker = createNoticeTracker(new Date("2026-09-06T12:00:00Z"));
  const notices = tracker.update(
    { codex: [{ ...base, completion: { id: "old", at } }] },
    new Date("2026-09-06T14:00:00Z"),
  );
  expect(notices).toEqual([]);
});

it("marks opened notices read without losing history or replaying the badge", () => {
  const tracker = createNoticeTracker(new Date(at));
  const activity = { codex: [{ ...base, completion: { id: "turn", at } }] };
  const first = tracker.update(activity, new Date(at));
  const ids = first.map((n) => n.id);
  expect(first.filter((n) => !n.read)).toHaveLength(1);
  expect(tracker.markRead(ids).filter((n) => !n.read)).toHaveLength(0);
  expect(tracker.update(activity, new Date(at))).toHaveLength(1);
  expect(tracker.get()[0]?.read).toBe(true);
  tracker.dismiss(ids[0] ?? "");
  expect(tracker.update(activity, new Date(at))).toEqual([]);
});

it("tracks Claude questions and completion previews without replaying a previous turn", () => {
  const claude = { ...base, providerId: "claude" as const };
  const question = {
    type: "assistant",
    timestamp: at,
    message: {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "AskUserQuestion" }],
    },
  };
  expect(applyLocalEvents(claude, JSON.stringify(question)).state).toBe(
    "waiting",
  );
  const done = {
    type: "assistant",
    timestamp: at,
    uuid: "done",
    message: {
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "Fixed the upload error.\nDetails follow." },
      ],
    },
  };
  const completed = applyLocalEvents(claude, JSON.stringify(done));
  expect(completed.completion?.summary).toBe("Fixed the upload error.");
  expect(
    applyLocalEvents(completed, JSON.stringify(question)).completion,
  ).toBeUndefined();
});

it("discovers fresh Grok phase events when the legacy registry is empty", async () => {
  const { readGrokSessions } = await import("./grok.ts");
  const host: import("./host.ts").ActivityHost = {
    now: () => new Date(at),
    homeDir: () => "/home",
    listDir: async (path) =>
      path.endsWith("sessions") ? ["project"] : ["fresh"],
    readFile: async (path) =>
      path.endsWith("summary.json")
        ? JSON.stringify({ generated_title: "Repair uploads" })
        : "[]",
    modifiedAt: async () => new Date(at),
    readTail: async () =>
      JSON.stringify({
        ts: at,
        type: "phase_changed",
        phase: "streaming_reasoning",
      }),
    isProcessAlive: async () => false,
    processStartedAt: async () => null,
    query: async () => [],
    interval: () => () => {},
  };
  expect(await readGrokSessions(host)).toMatchObject([
    {
      id: "grok.fresh",
      name: "Repair uploads",
      state: "busy",
      confirmed: true,
    },
  ]);
  host.now = () => new Date("2026-09-06T14:00:00Z");
  expect(await readGrokSessions(host)).toEqual([]);
});

it("automatically clears an earlier completion count when its task resumes", () => {
  const tracker = createNoticeTracker(new Date(at));
  tracker.update({ codex: [{ ...base, completion: { id: "turn", at } }] });
  const resumed = {
    ...base,
    state: "busy" as const,
    since: "2026-09-06T13:00:05Z",
  };
  const notices = tracker.update({ codex: [resumed] });
  expect(notices).toHaveLength(1);
  expect(notices[0]?.read).toBe(true);
});
