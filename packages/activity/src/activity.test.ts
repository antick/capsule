import { describe, expect, it, vi } from "vitest";
import {
  parseClaudeSession,
  parseProcStart,
  readClaudeSessions,
} from "./claude.ts";
import { codexSessionFrom, newestRollout, readCodexSessions } from "./codex.ts";
import type { ActivityHost } from "./host.ts";
import { createActivityMonitor } from "./monitor.ts";

const now = new Date("2026-09-05T22:00:00.000Z");

const record = {
  pid: 71555,
  sessionId: "c5ba92e2",
  cwd: "/Users/pankaj/Projects/personal/egglify",
  startedAt: 1788622255869,
  procStart: "Sat Sep  5 15:30:55 2026",
  entrypoint: "claude-desktop",
  name: "egglify-4e",
  status: "busy",
  updatedAt: 1788622256493,
};

function fakeHost(overrides: Partial<ActivityHost> = {}): ActivityHost {
  return {
    now: () => now,
    homeDir: () => "/home",
    listDir: () => Promise.resolve([]),
    readFile: () => Promise.resolve(null),
    modifiedAt: () => Promise.resolve(null),
    isProcessAlive: () => Promise.resolve(true),
    processStartedAt: () => Promise.resolve(null),
    query: () => Promise.resolve([]),
    interval: () => () => undefined,
    ...overrides,
  };
}

describe("parseClaudeSession", () => {
  it("reads what Claude Code writes, and names the surface", () => {
    const parsed = parseClaudeSession(record, now);
    expect(parsed?.pid).toBe(71555);
    expect(parsed?.session).toMatchObject({
      id: "claude.71555",
      providerId: "claude",
      name: "egglify-4e",
      detail: "Desktop · egglify",
      state: "busy",
      waitingFor: null,
    });
    expect(parsed?.session.since).toBe(new Date(1788622256493).toISOString());
    expect(parsed?.startedAt?.getTime()).toBe(1788622255869);
  });

  it("maps the normalised tempo before the raw status, and reads what it wants", () => {
    expect(
      parseClaudeSession(
        { ...record, tempo: "blocked", needs: "approval" },
        now,
      )?.session,
    ).toMatchObject({ state: "waiting", waitingFor: "approval" });
    expect(
      parseClaudeSession({ ...record, status: "idle" }, now)?.session.state,
    ).toBe("idle");
    expect(parseClaudeSession({ cwd: "/x" }, now)).toBeNull();
    expect(parseClaudeSession("nonsense", now)).toBeNull();
  });

  it("parses a ctime start with a space-padded day, in UTC", () => {
    expect(parseProcStart("Sat Sep  5 15:30:55 2026")?.toISOString()).toBe(
      "2026-09-05T15:30:55.000Z",
    );
    expect(parseProcStart("yesterday")).toBeNull();
  });
});

describe("readClaudeSessions", () => {
  const files: Record<string, string> = {
    "/home/.claude/sessions/71555.json": JSON.stringify(record),
    "/home/.claude/sessions/9.json": JSON.stringify({
      ...record,
      pid: 9,
      name: "dead",
    }),
    "/home/.claude/sessions/12.json": JSON.stringify({
      ...record,
      pid: 12,
      name: "recycled",
    }),
  };
  const host = fakeHost({
    listDir: () =>
      Promise.resolve(["71555.json", "9.json", "12.json", "x.key"]),
    readFile: (path) => Promise.resolve(files[path] ?? null),
    isProcessAlive: (pid) => Promise.resolve(pid !== 9),
    // Pid 12 started an hour after the session registered: a different process.
    processStartedAt: (pid) =>
      Promise.resolve(
        pid === 12 ? new Date(record.startedAt + 60 * 60_000) : null,
      ),
  });

  it("drops records whose process has gone or been reused", async () => {
    const sessions = await readClaudeSessions(host);
    expect(sessions.map((s) => s.name)).toEqual(["egglify-4e"]);
  });
});

describe("codexSessionFrom", () => {
  it("marks recent writes as an unconfirmed activity hint", () => {
    const fresh = codexSessionFrom(
      [{ id: "codex.a", name: "Codex", at: new Date(now.getTime() - 3000) }],
      now,
    );
    expect(fresh).toMatchObject({
      providerId: "codex",
      state: "busy",
      detail: "Recent activity · status unconfirmed",
    });
    expect(
      codexSessionFrom(
        [
          {
            id: "codex.a",
            name: "Codex",
            at: new Date(now.getTime() - 20_000),
          },
        ],
        now,
      ),
    ).toBeNull();
    expect(codexSessionFrom([], now)).toBeNull();
    expect(
      codexSessionFrom(
        [{ id: "codex.invalid", name: "Codex", at: new Date("invalid") }],
        now,
      ),
    ).toBeNull();
  });

  it("retains fresh distinct indexed sessions without borrowing the desktop title", async () => {
    const readFile = vi.fn(() => Promise.resolve(null));
    const times: Record<string, number> = {
      "/home/.codex/sessions/first.jsonl": 5000,
      "/home/.codex/sessions/second.jsonl": 1000,
      "/home/.codex/sessions/second-old.jsonl": 4000,
      "/home/.codex/sessions/stale.jsonl": 20_000,
    };
    const host = fakeHost({
      query: (path, _sql) =>
        Promise.resolve(
          path.endsWith("state_5.sqlite")
            ? [
                ["first", "First task", "~/.codex/sessions/first.jsonl"],
                ["second", "Second task", "~/.codex/sessions/second.jsonl"],
                ["second", "Older title", "~/.codex/sessions/second-old.jsonl"],
                ["stale", "Old task", "~/.codex/sessions/stale.jsonl"],
                [
                  "missing",
                  "Missing rollout",
                  "~/.codex/sessions/missing.jsonl",
                ],
              ]
            : [[String((now.getTime() - 1000) / 1000), "Fix the tests"]],
        ),
      modifiedAt: (path) =>
        Promise.resolve(
          times[path] !== undefined
            ? new Date(now.getTime() - times[path])
            : null,
        ),
      readFile,
    });
    const sessions = await readCodexSessions(host);
    expect(sessions.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "codex.first", name: "First task" },
      { id: "codex.second", name: "Second task" },
    ]);
    expect(readFile).not.toHaveBeenCalled();
    expect(await newestRollout(host)).toEqual({
      path: "~/.codex/sessions/second.jsonl",
      at: new Date(now.getTime() - 1000),
    });
  });

  it("uses the desktop fallback only when no rollout candidate exists", async () => {
    const host = fakeHost({
      query: (path) =>
        Promise.resolve(
          path.endsWith("state_5.sqlite")
            ? []
            : [[String((now.getTime() - 1000) / 1000), "Desktop task"]],
        ),
    });
    expect(await readCodexSessions(host)).toMatchObject([
      {
        id: "codex.desktop",
        name: "Desktop task",
        detail: "Recent activity · status unconfirmed",
      },
    ]);
    const staleRollout = fakeHost({
      ...host,
      query: (path, sql) =>
        path.endsWith("state_5.sqlite")
          ? Promise.resolve([["stale", "Old task", "/old.jsonl"]])
          : host.query(path, sql),
      modifiedAt: () => Promise.resolve(new Date(now.getTime() - 20_000)),
    });
    expect(await readCodexSessions(staleRollout)).toEqual([]);
  });

  it("falls back to the newest day folder when the index cannot be read", async () => {
    const tree: Record<string, string[]> = {
      "/home/.codex/sessions": ["2025", "2026"],
      "/home/.codex/sessions/2026": ["08", "09"],
      "/home/.codex/sessions/2026/09": ["04", "05"],
      "/home/.codex/sessions/2026/09/05": ["rollout-new.jsonl", "notes.txt"],
      "/home/.codex/sessions/2026/09/04": ["rollout-old.jsonl"],
    };
    const host = fakeHost({
      listDir: (dir) => Promise.resolve(tree[dir] ?? []),
      modifiedAt: (path) =>
        Promise.resolve(
          path.endsWith("rollout-new.jsonl")
            ? new Date(now.getTime() - 2000)
            : new Date(now.getTime() - 90_000),
        ),
    });
    const sessions = await readCodexSessions(host);
    expect(sessions[0]?.id).toBe("codex.rollout-new.jsonl");
  });
});

describe("createActivityMonitor", () => {
  it("publishes only when something changed, and knows when work is happening", async () => {
    const onChange = vi.fn();
    const host = fakeHost({
      listDir: (dir) =>
        Promise.resolve(dir.endsWith("sessions") ? ["71555.json"] : []),
      readFile: () => Promise.resolve(JSON.stringify(record)),
    });
    const monitor = createActivityMonitor({
      host,
      getEnabled: () => ["claude", "codex"],
      onChange,
    });
    await monitor.rescan();
    await monitor.rescan();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(monitor.isBusy()).toBe(true);
    expect(monitor.getActivity().claude?.[0]?.name).toBe("egglify-4e");
  });

  it("ignores providers that are switched off", async () => {
    const monitor = createActivityMonitor({
      host: fakeHost({
        listDir: () => Promise.resolve(["71555.json"]),
        readFile: () => Promise.resolve(JSON.stringify(record)),
      }),
      getEnabled: () => ["codex"],
      onChange: () => undefined,
    });
    await monitor.rescan();
    expect(monitor.isBusy()).toBe(false);
  });
});
