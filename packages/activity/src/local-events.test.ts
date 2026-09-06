import type { AgentSession } from "@capsule/config";
import { describe, expect, it } from "vitest";
import { readGrokSessions } from "./grok.ts";
import type { ActivityHost } from "./host.ts";
import { applyLocalEvents } from "./local-events.ts";
import { createNoticeTracker } from "./notices.ts";

const at = "2026-09-06T12:00:01.000Z";
const base: AgentSession = {
  id: "codex.test",
  providerId: "codex",
  name: "Example task",
  detail: "Local",
  state: "busy",
  confirmed: false,
  waitingFor: null,
  since: at,
};
const lines = (...rows: unknown[]) =>
  rows.map((row) => JSON.stringify(row)).join("\n");
const codex = (type: string, fields = {}) => ({
  timestamp: at,
  type: "event_msg",
  payload: { type, ...fields },
});

describe("local event evidence", () => {
  it("uses explicit completion events and never silence, truncation or aborts", () => {
    const done = applyLocalEvents(
      base,
      lines(
        codex("task_started"),
        codex("task_complete", {
          turn_id: "turn-1",
          last_agent_message: "private text",
        }),
      ),
    );
    expect(done.completion).toEqual({ id: "turn-1", at });
    expect(done).toMatchObject({ state: "idle", confirmed: true });
    expect(JSON.stringify(done)).not.toContain("private text");
    expect(applyLocalEvents(base, null).completion).toBeUndefined();
    expect(applyLocalEvents(base, '{"incomplete":').completion).toBeUndefined();
    expect(
      applyLocalEvents(base, lines(codex("turn_aborted"))).completion,
    ).toBeUndefined();
  });
  it("distinguishes Grok permission requests, resolutions, completed and failed turns", () => {
    const grok = { ...base, id: "grok.test", providerId: "grok" as const };
    const event = (type: string, extra = {}) => ({ type, ts: at, ...extra });
    expect(
      applyLocalEvents(grok, lines(event("permission_requested"))).state,
    ).toBe("waiting");
    expect(
      applyLocalEvents(
        grok,
        lines(event("permission_requested"), event("permission_resolved")),
      ).state,
    ).toBe("busy");
    expect(
      applyLocalEvents(grok, lines(event("turn_ended", { outcome: "failed" })))
        .completion,
    ).toBeUndefined();
    expect(
      applyLocalEvents(
        grok,
        lines(event("turn_ended", { outcome: "completed" })),
      ).completion?.at,
    ).toBe(at);
  });
  it("uses Claude end_turn but never a tool response as completion", () => {
    const claude = { ...base, providerId: "claude" as const };
    const row = {
      timestamp: at,
      type: "assistant",
      uuid: "reply-1",
      message: { stop_reason: "end_turn" },
    };
    expect(applyLocalEvents(claude, lines(row)).completion?.id).toBe("reply-1");
    expect(
      applyLocalEvents(
        claude,
        lines({ ...row, message: { stop_reason: "tool_use" } }),
      ).completion,
    ).toBeUndefined();
  });
  it("tracks pending synchronous Codex input requests without treating async prompts as blocked", () => {
    const request = {
      timestamp: at,
      type: "response_item",
      payload: {
        type: "function_call",
        name: "request_user_input",
        call_id: "call-1",
      },
    };
    const reply = {
      ...request,
      payload: { type: "function_call_output", call_id: "call-1" },
    };
    expect(applyLocalEvents(base, lines(request)).state).toBe("waiting");
    expect(applyLocalEvents(base, lines(request, reply)).state).toBe("busy");
    expect(
      applyLocalEvents(
        base,
        lines({
          ...request,
          payload: { ...request.payload, name: "request_user_input_async" },
        }),
      ).confirmed,
    ).toBe(false);
  });
});

describe("notice lifecycle", () => {
  it("ignores history, deduplicates, resolves waiting, and remembers dismissal", () => {
    const tracker = createNoticeTracker(new Date("2026-09-06T12:00:00Z"));
    const old = {
      ...base,
      completion: { id: "old", at: "2026-09-05T12:00:00Z" },
    };
    expect(tracker.update({ codex: [old] })).toEqual([]);
    const done = { ...base, completion: { id: "new", at } };
    expect(tracker.update({ codex: [done] })).toHaveLength(1);
    expect(tracker.update({ codex: [done] })).toHaveLength(1);
    tracker.dismiss(tracker.get()[0]?.id ?? "");
    expect(tracker.update({ codex: [done] })).toEqual([]);
    const waiting = { ...base, state: "waiting" as const, confirmed: true };
    expect(tracker.update({ codex: [waiting] })[0]?.kind).toBe("waiting");
    expect(tracker.update({ codex: [{ ...waiting, state: "busy" }] })).toEqual(
      [],
    );
    expect(tracker.update({})).toEqual([]);
  });
  it("keeps concurrent provider events distinct and rejects inferred waiting", () => {
    const tracker = createNoticeTracker(new Date("2026-09-06T12:00:00Z"));
    const finished = { ...base, completion: { id: "turn", at } };
    expect(
      tracker.update({
        codex: [finished],
        grok: [{ ...finished, id: "grok.test", providerId: "grok" }],
        claude: [{ ...base, id: "claude.test", state: "waiting" }],
      }),
    ).toHaveLength(2);
  });
});

it("discovers Grok locally and rejects dead processes and unsafe session ids", async () => {
  const host: ActivityHost = {
    now: () => new Date(at),
    homeDir: () => "/home",
    listDir: async () => ["project"],
    readFile: async () =>
      JSON.stringify([
        { session_id: "live", pid: 1, cwd: "/project", opened_at: at },
        { session_id: "dead", pid: 2, cwd: "/project", opened_at: at },
        { session_id: "../auth", pid: 1, cwd: "/project", opened_at: at },
      ]),
    modifiedAt: async () => new Date(at),
    isProcessAlive: async (pid) => pid === 1,
    processStartedAt: async () => null,
    query: async () => [],
    interval: () => () => {},
    readTail: async () => lines({ ts: at, type: "permission_requested" }),
  };
  expect(await readGrokSessions(host)).toMatchObject([
    { id: "grok.live", state: "waiting", confirmed: true },
  ]);
});
