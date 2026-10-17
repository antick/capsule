import { expect, it } from "vitest";
import { readGrokSessions } from "./grok.ts";
import type { ActivityHost } from "./host.ts";

/*
 * Local event evidence and the notice tracker are values now, in the fixture
 * corpus; see `activity-fixtures.test.ts`. Discovering Grok sessions on disk
 * needs a stubbed host, so it stays here.
 */
const at = "2026-09-06T12:00:01.000Z";
const lines = (...rows: unknown[]) =>
  rows.map((row) => JSON.stringify(row)).join("\n");

it("discovers Grok locally and rejects dead processes and unsafe session ids", async () => {
  const host: ActivityHost = {
    now: () => new Date(at),
    homeDir: () => "/home",
    listDir: async (path) => (path.endsWith("sessions") ? ["project"] : []),
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
