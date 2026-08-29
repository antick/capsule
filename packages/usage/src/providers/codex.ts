import {
  CODEX_AUTH_PATH_SEGMENTS,
  CODEX_HOME_ENV,
  CODEX_OAUTH_CLIENT_ID,
  CODEX_TOKEN_URL,
  CODEX_USAGE_FALLBACK_URL,
  CODEX_USAGE_URL,
  COPY,
  PROVIDER_LABELS,
  type UsageBucket,
  type UsageSnapshot,
} from "@capsule/config";
import { toPercent } from "../clamp.ts";
import { usageHeaders } from "../headers.ts";
import { credentialPath, resetIso, windowLabel } from "../reset.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface CodexWindow {
  used_percent?: number;
  utilization?: number;
  limit_window_seconds?: number;
  reset_at?: number | string;
  reset_after_seconds?: number;
  resets_at?: string;
  label?: string;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    primary_window?: CodexWindow | null;
    secondary_window?: CodexWindow | null;
    primary?: CodexWindow | null;
    secondary?: CodexWindow | null;
  } | null;
  primary_window?: CodexWindow;
  secondary_window?: CodexWindow;
}

interface CodexAuthFile {
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
  };
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
}

function authFromFile(raw: string): {
  accessToken: string | null;
  refreshToken: string | null;
  accountId: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as CodexAuthFile;
    return {
      accessToken: parsed.tokens?.access_token ?? parsed.access_token ?? null,
      refreshToken:
        parsed.tokens?.refresh_token ?? parsed.refresh_token ?? null,
      accountId: parsed.tokens?.account_id ?? parsed.account_id ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, accountId: null };
  }
}

function windowUsed(window: CodexWindow | null | undefined): number {
  return toPercent(window?.used_percent ?? window?.utilization);
}

function mapWindow(
  window: CodexWindow | null | undefined,
  id: string,
  fallbackLabel: string,
  fetchedAt: Date,
): UsageBucket | null {
  if (!window) {
    return null;
  }
  const resetsAt = resetIso(
    window.reset_at ?? window.resets_at,
    window.reset_after_seconds
      ? new Date(fetchedAt.getTime() + window.reset_after_seconds * 1000)
      : fetchedAt,
  );
  const seconds = window.limit_window_seconds;
  const relative = seconds != null && seconds <= 24 * 3600;
  return {
    id,
    label: window.label ?? windowLabel(seconds, fallbackLabel),
    percentUsed: windowUsed(window),
    resetsAt,
    resetStyle: relative ? "relative" : "absolute",
  };
}

export function mapCodexUsage(
  payload: CodexUsageResponse,
  fetchedAt: Date,
): UsageSnapshot {
  const rate = payload.rate_limit ?? {};
  const primary = rate.primary_window ?? rate.primary ?? payload.primary_window;
  const secondary =
    rate.secondary_window ?? rate.secondary ?? payload.secondary_window;
  const buckets = [
    mapWindow(primary, "primary", COPY.fiveHourWindow, fetchedAt),
    mapWindow(secondary, "secondary", COPY.weeklyWindow, fetchedAt),
  ].filter((item): item is UsageBucket => item !== null);
  return {
    providerId: "codex",
    displayName: PROVIDER_LABELS.codex,
    iconId: "codex",
    primaryPercent: buckets[0]?.percentUsed ?? windowUsed(primary),
    status: "ok",
    fetchedAt: fetchedAt.toISOString(),
    buckets,
  };
}

async function fetchUsage(
  context: UsageProviderContext,
  token: string,
  accountId: string | null,
  url: string,
): Promise<Response> {
  const headers = usageHeaders({
    Authorization: `Bearer ${token}`,
  });
  if (accountId) {
    headers["ChatGPT-Account-Id"] = accountId;
  }
  return context.fetch(url, { headers });
}

async function refreshAccessToken(
  context: UsageProviderContext,
  refreshToken: string,
): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CODEX_OAUTH_CLIENT_ID,
  });
  const response = await context.fetch(CODEX_TOKEN_URL, {
    method: "POST",
    headers: usageHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body,
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

export function createCodexProvider(): UsageProvider {
  return {
    id: "codex",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const authPath = credentialPath(
        context.homeDir,
        CODEX_HOME_ENV,
        CODEX_AUTH_PATH_SEGMENTS,
      );
      const raw = await context.readFile(authPath);
      const auth = raw
        ? authFromFile(raw)
        : { accessToken: null, refreshToken: null, accountId: null };
      let token = auth.accessToken;
      if (!token && auth.refreshToken) {
        token = await refreshAccessToken(context, auth.refreshToken);
      }
      if (!token) {
        return unauthenticatedSnapshot("codex", context.now);
      }
      let response = await fetchUsage(
        context,
        token,
        auth.accountId,
        CODEX_USAGE_URL,
      );
      if (response.status === 401 && auth.refreshToken) {
        const refreshed = await refreshAccessToken(context, auth.refreshToken);
        if (refreshed) {
          token = refreshed;
          response = await fetchUsage(
            context,
            token,
            auth.accountId,
            CODEX_USAGE_URL,
          );
        }
      }
      if (response.status === 404) {
        response = await fetchUsage(
          context,
          token,
          auth.accountId,
          CODEX_USAGE_FALLBACK_URL,
        );
      }
      if (response.status === 401 || response.status === 403) {
        return unauthenticatedSnapshot("codex", context.now);
      }
      if (!response.ok) {
        throw new Error(`Codex usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as CodexUsageResponse;
      return mapCodexUsage(payload, context.now);
    },
  };
}
