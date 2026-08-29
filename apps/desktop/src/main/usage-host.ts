import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { CapsuleSettings, UsageSnapshot } from "@capsule/config";
import {
  createClaudeProvider,
  createCodexProvider,
  createDemoProvider,
  createGrokProvider,
  createPoller,
  type Poller,
} from "@capsule/usage";
import { app, powerMonitor } from "electron";

const execFileAsync = promisify(execFile);

export function createUsageHost(
  getSettings: () => CapsuleSettings,
  onChange: (snapshots: UsageSnapshot[]) => void,
): Poller {
  const demo = getSettings().demoMode;
  const providers = demo
    ? [
        createDemoProvider("claude"),
        createDemoProvider("codex"),
        createDemoProvider("grok"),
      ]
    : [createClaudeProvider(), createCodexProvider(), createGrokProvider()];

  return createPoller({
    providers,
    getSettings,
    onChange,
    host: {
      now: () => new Date(),
      fetch: globalThis.fetch,
      homeDir: () => app.getPath("home"),
      readFile: async (absolutePath: string) => {
        try {
          return await readFile(absolutePath, "utf8");
        } catch {
          return null;
        }
      },
      readSecret: async (service: string) => {
        try {
          const { stdout } = await execFileAsync("security", [
            "find-generic-password",
            "-s",
            service,
            "-w",
          ]);
          const value = stdout.trim();
          return value.length > 0 ? value : null;
        } catch {
          return null;
        }
      },
      interval: (ms, tick) => {
        const id = setInterval(tick, ms);
        return () => clearInterval(id);
      },
      onResume: (tick) => {
        const handler = () => tick();
        powerMonitor.on("resume", handler);
        return () => {
          powerMonitor.off("resume", handler);
        };
      },
      onOnline: (tick) => {
        const handler = () => tick();
        powerMonitor.on("unlock-screen", handler);
        return () => {
          powerMonitor.off("unlock-screen", handler);
        };
      },
    },
  });
}
