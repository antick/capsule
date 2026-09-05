import { describe, expect, it } from "vitest";
import {
  type AgentSession,
  anyAgentActive,
  orderSessions,
  summarizeActivity,
} from "./activity.ts";

function session(
  id: string,
  state: AgentSession["state"],
  since = "2026-08-27T11:00:00.000Z",
): AgentSession {
  return {
    id,
    providerId: "claude",
    name: id,
    detail: "Terminal · repo",
    state,
    waitingFor: null,
    since,
  };
}

describe("summarizeActivity", () => {
  it("is nothing when nothing is running", () => {
    expect(summarizeActivity([])).toBeNull();
    expect(summarizeActivity(undefined)).toBeNull();
  });

  it("lets a session waiting on you outrank a busy one", () => {
    expect(
      summarizeActivity([session("a", "busy"), session("b", "waiting")])?.state,
    ).toBe("waiting");
    expect(
      summarizeActivity([session("a", "busy"), session("b", "idle")])?.state,
    ).toBe("working");
    expect(summarizeActivity([session("a", "idle")])?.state).toBe("idle");
  });
});

describe("orderSessions", () => {
  it("puts waiting first, then busy, newest first within a rank", () => {
    const ordered = orderSessions([
      session("idle", "idle"),
      session("busy-old", "busy", "2026-08-27T10:00:00.000Z"),
      session("busy-new", "busy", "2026-08-27T11:00:00.000Z"),
      session("waiting", "waiting"),
    ]);
    expect(ordered.map((s) => s.id)).toEqual([
      "waiting",
      "busy-new",
      "busy-old",
      "idle",
    ]);
  });
});

describe("anyAgentActive", () => {
  it("only counts sessions that are doing something", () => {
    expect(anyAgentActive({})).toBe(false);
    expect(anyAgentActive({ claude: [session("a", "idle")] })).toBe(false);
    expect(anyAgentActive({ codex: [session("a", "busy")] })).toBe(true);
  });
});
