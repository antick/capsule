import { readFile } from "node:fs/promises";
import type { CapsuleSettings, UsageSnapshot } from "@capsule/config";
import {
  createChatgptProvider,
  createClaudeProvider,
  createDemoProvider,
  createPoller,
  createSparkProvider,
  type Poller,
} from "@capsule/usage";
import { app, powerMonitor } from "electron";

export function createUsageHost(
  getSettings: () => CapsuleSettings,
  onChange: (snapshots: UsageSnapshot[]) => void,
): Poller {
  const demo = getSettings().demoMode;
  const providers = demo
    ? [
        createDemoProvider("claude"),
        createDemoProvider("chatgpt"),
        createDemoProvider("spark"),
      ]
    : [
        createClaudeProvider(),
        createChatgptProvider(),
        createSparkProvider({ demoBacked: false }),
      ];

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
