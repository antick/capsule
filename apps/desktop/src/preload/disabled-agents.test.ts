import { AGENT_COPY } from "@capsule/config";
import { expect, it, vi } from "vitest";
import type { CapsuleBridge } from "./index.ts";

const mocks = vi.hoisted(() => ({
  expose: vi.fn(),
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
}));
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: mocks.expose },
  ipcRenderer: { invoke: mocks.invoke, send: mocks.send, on: mocks.on },
}));

it("rejects every saved chat entry point without sending IPC or subscribing", async () => {
  await import("./index.ts");
  const bridge = mocks.expose.mock.calls[0]?.[1] as CapsuleBridge;
  const commands = [
    () => bridge.openAgents("claude"),
    () => bridge.getAgents(),
    () => bridge.selectAgent("claude.test"),
    () => bridge.sendAgentMessage("claude.test", "must not send"),
    () => bridge.respondAgentRequest("codex.test", "request", true),
    () => bridge.getAgentSetup(),
  ];
  for (const command of commands)
    await expect(command()).rejects.toThrow(AGENT_COPY.disabled);
  bridge.closeAgents();
  bridge.onAgents(vi.fn())();
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.on).not.toHaveBeenCalled();
});
