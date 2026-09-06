import { defaultSettings } from "@capsule/config";
import { beforeEach, expect, it, vi } from "vitest";
import { createUsageHost } from "./usage-host.ts";

const mocks = vi.hoisted(() => ({
  poller: vi.fn(),
  claude: vi.fn(() => ({ id: "claude" })),
  codex: vi.fn(() => ({ id: "codex" })),
  grok: vi.fn(() => ({ id: "grok" })),
  cursor: vi.fn(() => ({ id: "cursor" })),
  copilot: vi.fn(() => ({ id: "copilot" })),
  demo: vi.fn((id: string) => ({ id, demo: true })),
}));
vi.mock("@capsule/usage", () => ({
  createPoller: mocks.poller,
  createClaudeProvider: mocks.claude,
  createCodexProvider: mocks.codex,
  createGrokProvider: mocks.grok,
  createCursorProvider: mocks.cursor,
  createCopilotProvider: mocks.copilot,
  createDemoProvider: mocks.demo,
}));
vi.mock("./store.ts", () => ({
  loadBackoff: vi.fn(),
  saveBackoff: vi.fn(),
  loadSnapshots: vi.fn(() => []),
  saveSnapshots: vi.fn(),
}));
vi.mock("electron", () => ({ app: {}, powerMonitor: {} }));
beforeEach(() => vi.clearAllMocks());

it("connects the existing usage providers to the poller with activity-aware timing", () => {
  const settings = { ...defaultSettings(), demoMode: false };
  const isBusy = vi.fn(() => true);
  createUsageHost(() => settings, vi.fn(), { isBusy });
  expect(mocks.claude).toHaveBeenCalledOnce();
  expect(mocks.codex).toHaveBeenCalledOnce();
  expect(mocks.grok).toHaveBeenCalledOnce();
  expect(mocks.cursor).toHaveBeenCalledOnce();
  expect(mocks.copilot).toHaveBeenCalledOnce();
  expect(mocks.demo).not.toHaveBeenCalled();
  expect(mocks.poller).toHaveBeenCalledWith(
    expect.objectContaining({
      providers: [
        { id: "claude" },
        { id: "codex" },
        { id: "grok" },
        { id: "cursor" },
        { id: "copilot" },
      ],
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
