import { expect, it } from "vitest";

/*
 * The other regressions here — the current Claude registry format, cleared
 * completions, late and future completions, read state, Claude questions and
 * previews, resumed tasks — are values now, in the fixture corpus. See
 * `activity-fixtures.test.ts`. This one needs a stubbed host.
 */
const at = "2026-09-06T13:00:00Z";

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
