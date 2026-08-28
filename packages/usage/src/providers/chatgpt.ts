import { join } from "node:path";
import {
  CHATGPT_USAGE_URL,
  CODEX_AUTH_PATH_SEGMENTS,
  COPY,
} from "@capsule/config";
import { clampPercent } from "../clamp.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface WindowPayload {
  utilization?: number;
  used_percent?: number;
  resets_at?: string;
  reset_at?: string;
  label?: string;
}

interface ChatgptUsageResponse {
  primary?: WindowPayload;
  secondary?: WindowPayload;
  primary_window?: WindowPayload;
  secondary_window?: WindowPayload;
}

interface CodexAuthFile {
  tokens?: { access_token?: string };
  access_token?: string;
}

function tokenFromFile(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as CodexAuthFile;
    return parsed.tokens?.access_token ?? parsed.access_token ?? null;
  } catch {
    return null;
  }
}

function windowPercent(window: WindowPayload | undefined): number {
  return clampPercent(window?.utilization ?? window?.used_percent ?? 0);
}

function windowReset(
  window: WindowPayload | undefined,
  fallback: string,
): string {
  return window?.resets_at ?? window?.reset_at ?? fallback;
}

export function mapChatgptUsage(
  payload: ChatgptUsageResponse,
  fetchedAt: Date,
) {
  const primary = payload.primary ?? payload.primary_window;
  const secondary = payload.secondary ?? payload.secondary_window;
  const fetched = fetchedAt.toISOString();
  return {
    providerId: "chatgpt" as const,
    displayName: "ChatGPT",
    iconId: "chatgpt" as const,
    primaryPercent: windowPercent(primary),
    status: "ok" as const,
    fetchedAt: fetched,
    buckets: [
      {
        id: "primary",
        label: primary?.label ?? COPY.chatgptPrimary,
        percentUsed: windowPercent(primary),
        resetsAt: windowReset(primary, fetched),
        resetStyle: "relative" as const,
      },
      {
        id: "secondary",
        label: secondary?.label ?? COPY.chatgptSecondary,
        percentUsed: windowPercent(secondary),
        resetsAt: windowReset(secondary, fetched),
        resetStyle: "absolute" as const,
      },
    ],
  };
}

export function createChatgptProvider(): UsageProvider {
  return {
    id: "chatgpt",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const authPath = join(context.homeDir, ...CODEX_AUTH_PATH_SEGMENTS);
      const raw = await context.readFile(authPath);
      const token = raw ? tokenFromFile(raw) : null;
      if (!token) {
        return unauthenticatedSnapshot("chatgpt", context.now);
      }
      const response = await context.fetch(CHATGPT_USAGE_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        return unauthenticatedSnapshot("chatgpt", context.now);
      }
      if (!response.ok) {
        throw new Error(`ChatGPT usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as ChatgptUsageResponse;
      return mapChatgptUsage(payload, context.now);
    },
  };
}
