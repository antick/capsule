import type { ProviderId } from "@capsule/config";
import { goldenSuite } from "@capsule/fixtures/vitest";
import { afterAll, beforeAll, vi } from "vitest";
import { RateLimitedError } from "./backoff.ts";
import { createClaudeProvider } from "./providers/claude.ts";
import { createCodexProvider } from "./providers/codex.ts";
import { createCopilotProvider } from "./providers/copilot.ts";
import { createCursorProvider } from "./providers/cursor.ts";
import { createGrokProvider } from "./providers/grok.ts";
import type { UsageProvider, UsageProviderContext } from "./types.ts";

/**
 * Each provider's whole read against a stub world, recorded with every
 * request it made, so a port has to ask the same questions in the same order
 * — not only arrive at the same answer.
 */

interface StubResponse {
  url: string;
  method?: string;
  authorization?: string;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  fail?: boolean;
}

interface World {
  provider: ProviderId;
  home: string;
  files: Record<string, string>;
  secrets: Record<string, string>;
  commands: { file: string; args: string[]; output: string | null }[];
  env: Record<string, string>;
  responses: StubResponse[];
}

interface Recorded {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

const PROVIDERS: Record<ProviderId, () => UsageProvider> = {
  claude: createClaudeProvider,
  codex: createCodexProvider,
  grok: createGrokProvider,
  cursor: createCursorProvider,
  copilot: createCopilotProvider,
};

/** The environment the providers read. Cleared for every case, so nothing on
 * the machine doing the recording can leak into the corpus. */
const ENV_NAMES = ["CODEX_HOME", "GROK_HOME", "GITHUB_TOKEN"] as const;

function stub(world: World, now: Date) {
  const requests: Recorded[] = [];
  const context: UsageProviderContext = {
    now,
    homeDir: world.home,
    readFile: async (path) => world.files[path] ?? null,
    readSecret: async (service) => world.secrets[service] ?? null,
    runCommand: async (file, args) =>
      world.commands.find(
        (c) => c.file === file && c.args.join("\u0000") === args.join("\u0000"),
      )?.output ?? null,
    fetch: (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      requests.push({
        method,
        url,
        headers,
        ...(init.body === undefined ? {} : { body: String(init.body) }),
      });
      const match = world.responses.find(
        (r) =>
          r.url === url &&
          (r.method ?? "GET") === method &&
          (r.authorization === undefined ||
            r.authorization === headers.authorization),
      );
      if (!match || match.fail) {
        throw new TypeError("fetch failed");
      }
      const body =
        match.body === undefined
          ? null
          : typeof match.body === "string"
            ? match.body
            : JSON.stringify(match.body);
      return new Response(body, {
        status: match.status ?? 200,
        headers: match.headers,
      });
    }) as typeof fetch,
  };
  return { context, requests };
}

beforeAll(() => {
  // Grok prefers an unexpired token by asking Date.now(), so freeze it.
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterAll(() => {
  vi.useRealTimers();
});

goldenSuite("usage/provider-reads", async (world: World, now) => {
  vi.setSystemTime(now);
  const saved = Object.fromEntries(ENV_NAMES.map((n) => [n, process.env[n]]));
  for (const name of ENV_NAMES) delete process.env[name];
  Object.assign(process.env, world.env);
  const { context, requests } = stub(world, now);
  try {
    const snapshot = await PROVIDERS[world.provider]().fetchSnapshot(context);
    return { outcome: { snapshot }, requests };
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return {
        outcome: {
          rateLimited: {
            retryAfterMs: error.retryAfterMs,
            fallback: error.fallback,
          },
        },
        requests,
      };
    }
    // The message belongs to the implementation that threw it.
    return { outcome: { failed: true }, requests };
  } finally {
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
