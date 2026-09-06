import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { promisify } from "node:util";
import {
  type CapsuleSettings,
  USAGE_USER_AGENT,
  type UsageSnapshot,
} from "@capsule/config";
import {
  createClaudeProvider,
  createCodexProvider,
  createDemoProvider,
  createGrokProvider,
  createPoller,
  type Poller,
} from "@capsule/usage";
import { app, powerMonitor } from "electron";
import { loadBackoff, saveBackoff } from "./store.ts";

const execFileAsync = promisify(execFile);

export function createUsageHost(
  getSettings: () => CapsuleSettings,
  onChange: (snapshots: UsageSnapshot[]) => void,
  options: {
    /** Whether an agent is working, so polling can slow down when none is. */
    isBusy?: () => boolean;
  } = {},
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
    isBusy: options.isBusy,
    host: {
      now: () => new Date(),
      fetch: usageFetch,
      loadBackoff,
      saveBackoff,
      homeDir: () => {
        try {
          return app.getPath("home");
        } catch {
          return homedir();
        }
      },
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

const usageFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", USAGE_USER_AGENT);
  }
  return globalThis.fetch(input, { ...init, headers });
};
