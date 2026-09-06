import { join } from "node:path";
import {
  ANTHROPIC_OAUTH_BETA_HEADER,
  ANTHROPIC_OAUTH_USAGE_URL,
  CLAUDE_CREDENTIALS_PATH_SEGMENTS,
  CLAUDE_KEYCHAIN_SERVICE,
  CLAUDE_USAGE_CACHE_FILE,
  COPY,
  PROVIDER_LABELS,
  type UsageSnapshot,
} from "@capsule/config";
import { RateLimitedError, retryAfterMs } from "../backoff.ts";
import { toPercent } from "../clamp.ts";
import { usageHeaders } from "../headers.ts";
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

function windowIsCurrent(
  window: WindowUsage | null | undefined,
  now: Date,
): boolean {
  if (!window?.resets_at) {
    return false;
  }
  const resetsAt = new Date(window.resets_at).getTime();
  return Number.isFinite(resetsAt) && resetsAt > now.getTime();
}

export function claudeUsageFromCache(raw: string): ClaudeUsageResponse | null {
  try {
    const parsed = JSON.parse(raw) as {
      cachedUsageUtilization?: ClaudeUsageResponse & {
        utilization?: ClaudeUsageResponse;
      };
    };
    const cache = parsed.cachedUsageUtilization;
    if (!cache) {
      return null;
    }
    const utilization = cache.utilization ?? cache;
    if (utilization.five_hour || utilization.seven_day) {
      return utilization;
    }
    return null;
  } catch {
    return null;
  }
}

async function cachedClaudeSnapshot(
  context: UsageProviderContext,
): Promise<UsageSnapshot | null> {
  const raw = await context.readFile(
    join(context.homeDir, CLAUDE_USAGE_CACHE_FILE),
  );
  if (!raw) {
    return null;
  }
  const payload = claudeUsageFromCache(raw);
  if (!payload) {
    return null;
  }
  // A cache whose windows have all rolled over says nothing about today's usage.
  if (
    !windowIsCurrent(payload.five_hour, context.now) &&
    !windowIsCurrent(payload.seven_day, context.now)
  ) {
    return null;
  }
  return { ...mapClaudeUsage(payload, context.now), status: "stale" };
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
      const tokens = [
        keychainToken(
          (await context.readSecret?.(CLAUDE_KEYCHAIN_SERVICE)) ?? null,
        ),
        raw ? tokenFromFile(raw) : null,
      ].filter((value): value is string => value !== null);

      let lastError: Error | null = null;
      let refused: RateLimitedError | null = null;
      for (const token of new Set(tokens)) {
        try {
          const response = await context.fetch(ANTHROPIC_OAUTH_USAGE_URL, {
            headers: usageHeaders({
              Authorization: `Bearer ${token}`,
              "anthropic-beta": ANTHROPIC_OAUTH_BETA_HEADER,
            }),
          });
          if (response.ok) {
            const payload = (await response.json()) as ClaudeUsageResponse;
            return mapClaudeUsage(payload, context.now);
          }
          if (response.status === 429) {
            refused = new RateLimitedError(
              retryAfterMs(response.headers.get("Retry-After"), context.now),
            );
            break;
          }
          // 401/403 means this credential is dead; fall through to the next one.
          if (response.status !== 401 && response.status !== 403) {
            lastError = new Error(`Claude usage HTTP ${response.status}`);
            break;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          break;
        }
      }

      const cached = await cachedClaudeSnapshot(context);
      // Told to wait: say so, so the poller backs off instead of knocking
      // again next minute — which is what keeps the door shut. The local
      // cache still rides along, for the poller to show meanwhile.
      if (refused) {
        throw new RateLimitedError(refused.retryAfterMs, cached);
      }
      if (cached) {
        return cached;
      }
      if (lastError) {
        throw lastError;
      }
      return unauthenticatedSnapshot("claude", context.now);
    },
  };
}
