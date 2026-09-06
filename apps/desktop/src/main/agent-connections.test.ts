import { EventEmitter } from "node:events";
import type { ConnectedAgent } from "@capsule/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  request: vi.fn(),
  readdir: vi.fn(),
  spawn: vi.fn(),
  connect: vi.fn(),
}));

// Only the transport and filesystem edges are fake. The manager and Codex
// adapter run normally; these checks never start a CLI or touch a user socket.
vi.mock("node:child_process", () => ({ spawn: io.spawn }));
vi.mock("node:net", () => ({ connect: io.connect }));
vi.mock("node:fs/promises", () => ({
  constants: { X_OK: 1 },
  access: vi.fn(async () => undefined),
  readdir: io.readdir,
  lstat: vi.fn(async () => ({
    uid: process.getuid?.(),
    mode: 0o700,
    isSocket: () => true,
    isDirectory: () => true,
    isSymbolicLink: () => false,
  })),
}));
vi.mock("@capsule/activity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capsule/activity")>()),
  JsonRpc: class {
    connected = true;
    request(method: string, params?: unknown) {
      return io.request(method, params);
    }
    write() {}
    close() {
      this.connected = false;
    }
  },
}));

import { AgentConnections } from "./agent-connections.ts";

const channel: ConnectedAgent = {
  id: "claude.42",
  providerId: "claude",
  name: "Connected session",
  detail: "/test/project",
  state: "idle",
  waitingFor: null,
  since: "2026-09-06T12:00:00.000Z",
  connection: "connected",
  messages: [],
  note: "Connected through the test channel",
};

let manager: AgentConnections | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  io.readdir.mockResolvedValue([]);
  io.spawn.mockImplementation(() =>
    Object.assign(new EventEmitter(), { kill: vi.fn() }),
  );
  io.connect.mockReturnValue({ destroy: vi.fn() });
  io.request.mockImplementation(async (method: string) => {
    if (method === "thread/loaded/list") return { data: [] };
    if (method === "snapshot") return channel;
    return {};
  });
});
afterEach(() => manager?.stop());

describe("agent connection manager", () => {
  it("keeps unmatched detected Codex sessions view-only when the connected list is empty", async () => {
    const observed = {
      ...channel,
      id: "codex.detected-terminal",
      providerId: "codex" as const,
      name: "Existing terminal session",
    };
    manager = new AgentConnections(
      () => ({ codex: [observed] }),
      () => ["codex"],
      vi.fn(),
    );
    await manager.refresh();

    expect(io.request).toHaveBeenCalledWith(
      "thread/loaded/list",
      expect.anything(),
    );
    expect(
      manager.get().connections.find((entry) => entry.provider === "codex")
        ?.connected,
    ).toBe(true);
    expect(manager.get().sessions).toEqual([
      expect.objectContaining({
        id: observed.id,
        name: observed.name,
        connection: "view-only",
      }),
    ]);
    await expect(
      manager.send(observed.id, "Do not deliver this"),
    ).rejects.toThrow("view only");
    expect(io.request).not.toHaveBeenCalledWith(
      "turn/start",
      expect.anything(),
    );
  });

  it("keeps a connected Claude target routable while its refreshed snapshot is pending", async () => {
    io.readdir.mockResolvedValue(["channel.sock"]);
    manager = new AgentConnections(
      () => ({}),
      () => ["claude"],
      vi.fn(),
    );
    await manager.refresh();
    expect(manager.get().sessions[0]?.connection).toBe("connected");

    let finishSnapshot: (value: ConnectedAgent) => void = () => {};
    const snapshot = new Promise<ConnectedAgent>((resolve) => {
      finishSnapshot = resolve;
    });
    let markStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    io.request.mockImplementation((method: string) => {
      if (method === "snapshot") {
        markStarted();
        return snapshot;
      }
      return Promise.resolve({});
    });
    const refreshing = manager.refresh();
    await started;
    try {
      await expect(
        manager.send(channel.id, "Continue the connected session"),
      ).resolves.toBeUndefined();
      expect(io.request).toHaveBeenCalledWith("send", {
        text: "Continue the connected session",
      });
      expect(io.connect).toHaveBeenCalledTimes(1);
    } finally {
      finishSnapshot(channel);
      await refreshing;
    }
  });
});
