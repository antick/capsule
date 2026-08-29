import { join } from "node:path";
import {
  ANTHROPIC_OAUTH_BETA_HEADER,
  ANTHROPIC_OAUTH_USAGE_URL,
  CLAUDE_CREDENTIALS_PATH_SEGMENTS,
  CLAUDE_KEYCHAIN_SERVICE,
  COPY,
  PROVIDER_LABELS,
  type UsageSnapshot,
} from "@capsule/config";
import { toPercent } from "../clamp.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface WindowUsage {
  utilization?: number | null;
  resets_at?: string | null;
}

interface ClaudeUsageResponse {
  five_hour?: WindowUsage | null;
  seven_day?: WindowUsage | null;
}

interface ClaudeCredentialsFile {
  claudeAiOauth?: {
    accessToken?: string;
  };
  accessToken?: string;
}

function tokenFromFile(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as ClaudeCredentialsFile;
    return parsed.claudeAiOauth?.accessToken ?? parsed.accessToken ?? null;
  } catch {
    return raw.trim().length > 20 ? raw.trim() : null;
  }
}

function keychainToken(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  return tokenFromFile(raw);
}

export function mapClaudeUsage(
  payload: ClaudeUsageResponse,
  fetchedAt: Date,
): UsageSnapshot {
  const session = payload.five_hour;
  const weekly = payload.seven_day;
  const sessionPercent = toPercent(session?.utilization);
  return {
    providerId: "claude",
    displayName: PROVIDER_LABELS.claude,
    iconId: "claude",
    primaryPercent: sessionPercent,
    status: "ok",
    fetchedAt: fetchedAt.toISOString(),
    buckets: [
      {
        id: "current-session",
        label: COPY.currentSession,
        percentUsed: sessionPercent,
        resetsAt: session?.resets_at ?? fetchedAt.toISOString(),
        resetStyle: "relative",
      },
      {
        id: "all-models",
        label: COPY.allModels,
        percentUsed: toPercent(weekly?.utilization),
        resetsAt: weekly?.resets_at ?? fetchedAt.toISOString(),
        resetStyle: "absolute",
      },
    ],
  };
}

export function createClaudeProvider(): UsageProvider {
  return {
    id: "claude",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const credentialsPath = join(
        context.homeDir,
        ...CLAUDE_CREDENTIALS_PATH_SEGMENTS,
      );
      const raw = await context.readFile(credentialsPath);
      const fromFile = raw ? tokenFromFile(raw) : null;
      const fromKeychain = fromFile
        ? null
        : ((await context.readSecret?.(CLAUDE_KEYCHAIN_SERVICE)) ?? null);
      const token = fromFile ?? keychainToken(fromKeychain);
      if (!token) {
        return unauthenticatedSnapshot("claude", context.now);
      }
      const response = await context.fetch(ANTHROPIC_OAUTH_USAGE_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-beta": ANTHROPIC_OAUTH_BETA_HEADER,
        },
      });
      if (response.status === 401 || response.status === 403) {
        return unauthenticatedSnapshot("claude", context.now);
      }
      if (!response.ok) {
        throw new Error(`Claude usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as ClaudeUsageResponse;
      return mapClaudeUsage(payload, context.now);
    },
  };
}
