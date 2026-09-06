import { defaultSettings } from "@capsule/config";
import { beforeEach, expect, it, vi } from "vitest";
import { createUsageHost } from "./usage-host.ts";

const mocks = vi.hoisted(() => ({
  poller: vi.fn(),
  claude: vi.fn(() => ({ id: "claude" })),
  codex: vi.fn(() => ({ id: "codex" })),
  grok: vi.fn(() => ({ id: "grok" })),
  demo: vi.fn((id: string) => ({ id, demo: true })),
}));
vi.mock("@capsule/usage", () => ({
  createPoller: mocks.poller,
  createClaudeProvider: mocks.claude,
  createCodexProvider: mocks.codex,
  createGrokProvider: mocks.grok,
  createDemoProvider: mocks.demo,
}));
vi.mock("./store.ts", () => ({ loadBackoff: vi.fn(), saveBackoff: vi.fn() }));
vi.mock("electron", () => ({ app: {}, powerMonitor: {} }));
beforeEach(() => vi.clearAllMocks());

it("connects the existing usage providers to the poller with activity-aware timing", () => {
  const settings = { ...defaultSettings(), demoMode: false };
  const isBusy = vi.fn(() => true);
  createUsageHost(() => settings, vi.fn(), { isBusy });
  expect(mocks.claude).toHaveBeenCalledOnce();
  expect(mocks.codex).toHaveBeenCalledOnce();
  expect(mocks.grok).toHaveBeenCalledOnce();
  expect(mocks.demo).not.toHaveBeenCalled();
  expect(mocks.poller).toHaveBeenCalledWith(
    expect.objectContaining({
      providers: [{ id: "claude" }, { id: "codex" }, { id: "grok" }],
      isBusy,
    }),
  );
});

it("keeps demo mode entirely on sample providers", () => {
  createUsageHost(() => ({ ...defaultSettings(), demoMode: true }), vi.fn());
  expect(mocks.demo).toHaveBeenCalledTimes(3);
  expect(mocks.claude).not.toHaveBeenCalled();
  expect(mocks.codex).not.toHaveBeenCalled();
  expect(mocks.grok).not.toHaveBeenCalled();
});
