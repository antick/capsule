import { join } from "node:path";
import {
  COPILOT_APPS_PATH_SEGMENTS,
  COPILOT_USAGE_URL,
  COPY,
  GH_CLI_COMMAND,
  GH_CLI_TOKEN_ARGS,
  GITHUB_TOKEN_ENV,
  PROVIDER_LABELS,
  type UsageBucket,
  type UsageSnapshot,
} from "@capsule/config";
import { RateLimitedError, retryAfterMs } from "../backoff.ts";
import { toPercent } from "../clamp.ts";
import { usageHeaders } from "../headers.ts";
import { resetIso } from "../reset.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface CopilotQuota {
  percent_remaining?: number | null;
  unlimited?: boolean | null;
}

interface CopilotUser {
  quota_snapshots?: {
    premium_interactions?: CopilotQuota | null;
    chat?: CopilotQuota | null;
  } | null;
  quota_reset_date?: string | null;
}

/** Copilot's own login file: one entry per GitHub host, each with a token. */
export function copilotTokenFromApps(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, { oauth_token?: unknown }>;
    for (const entry of Object.values(parsed)) {
      if (typeof entry?.oauth_token === "string" && entry.oauth_token) {
        return entry.oauth_token;
      }
    }
  } catch {
    // Not JSON; nothing to take from it.
  }
  return null;
}

function bucket(
  id: string,
  label: string,
  quota: CopilotQuota | null | undefined,
  resetsAt: string,
): UsageBucket | null {
  // An unlimited quota has no percentage to show, and inventing one lies.
  if (
    !quota ||
    quota.unlimited ||
    typeof quota.percent_remaining !== "number"
  ) {
    return null;
  }
  return {
    id,
    label,
    percentUsed: toPercent(100 - quota.percent_remaining),
    resetsAt,
    resetStyle: "absolute",
  };
}

export function mapCopilotUsage(
  payload: CopilotUser,
  fetchedAt: Date,
): UsageSnapshot {
  const resetsAt = resetIso(payload.quota_reset_date, fetchedAt);
  const buckets = [
    bucket(
      "premium",
      COPY.copilotPremium,
      payload.quota_snapshots?.premium_interactions,
      resetsAt,
    ),
    bucket("chat", COPY.copilotChat, payload.quota_snapshots?.chat, resetsAt),
  ].filter((item): item is UsageBucket => item !== null);
  return {
    providerId: "copilot",
    displayName: PROVIDER_LABELS.copilot,
    iconId: "copilot",
    primaryPercent: buckets[0]?.percentUsed ?? null,
    status: "ok",
    fetchedAt: fetchedAt.toISOString(),
    buckets,
  };
}

/**
 * Whatever GitHub login this Mac already has, in the order a developer would
 * expect: an explicit token, the gh CLI's, then Copilot's own.
 */
async function githubToken(
  context: UsageProviderContext,
): Promise<string | null> {
  const fromEnv =
    typeof process !== "undefined" ? process.env[GITHUB_TOKEN_ENV]?.trim() : "";
  if (fromEnv) {
    return fromEnv;
  }
  const fromCli = (
    await context.runCommand?.(GH_CLI_COMMAND, GH_CLI_TOKEN_ARGS)
  )?.trim();
  if (fromCli) {
    return fromCli;
  }
  const apps = await context.readFile(
    join(context.homeDir, ...COPILOT_APPS_PATH_SEGMENTS),
  );
  return apps ? copilotTokenFromApps(apps) : null;
}

export function createCopilotProvider(): UsageProvider {
  return {
    id: "copilot",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const token = await githubToken(context);
      if (!token) {
        return unauthenticatedSnapshot("copilot", context.now);
      }
      const response = await context.fetch(COPILOT_USAGE_URL, {
        headers: usageHeaders({ Authorization: `token ${token}` }),
      });
      // 404 is GitHub's way of saying this account has no Copilot at all.
      if ([401, 403, 404].includes(response.status)) {
        return unauthenticatedSnapshot("copilot", context.now);
      }
      if (response.status === 429) {
        throw new RateLimitedError(
          retryAfterMs(response.headers.get("Retry-After"), context.now),
        );
      }
      if (!response.ok) {
        throw new Error(`Copilot usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as CopilotUser;
      return mapCopilotUsage(payload, context.now);
    },
  };
}
