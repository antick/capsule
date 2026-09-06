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
  createCopilotProvider,
  createCursorProvider,
  createDemoProvider,
  createGrokProvider,
  createPoller,
  type Poller,
} from "@capsule/usage";
import { app, powerMonitor } from "electron";
import {
  loadBackoff,
  loadSnapshots,
  saveBackoff,
  saveSnapshots,
} from "./store.ts";

const execFileAsync = promisify(execFile);

/** Long enough for `gh` to wake up, short enough that a hung tool cannot stall a poll. */
const COMMAND_TIMEOUT_MS = 8000;

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
    : [
        createClaudeProvider(),
        createCodexProvider(),
        createGrokProvider(),
        createCursorProvider(),
        createCopilotProvider(),
      ];

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
      loadSnapshots,
      saveSnapshots,
      runCommand: async (file, args) => {
        try {
          const { stdout } = await execFileAsync(file, [...args], {
            timeout: COMMAND_TIMEOUT_MS,
            env: { ...process.env, PATH: commandPath() },
          });
          return stdout;
        } catch {
          return null;
        }
      },
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

/**
 * A menu-bar app launched from Finder inherits a bare PATH, so the places
 * Homebrew and the CLIs' own installers put things are added explicitly.
 */
function commandPath(): string {
  const extra = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    `${homedir()}/.local/bin`,
  ];
  const current = (process.env.PATH ?? "").split(":").filter(Boolean);
  return [...new Set([...current, ...extra])].join(":");
}

const usageFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", USAGE_USER_AGENT);
  }
  return globalThis.fetch(input, { ...init, headers });
};
