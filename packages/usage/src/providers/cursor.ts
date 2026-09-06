import { join } from "node:path";
import {
  COPY,
  CURSOR_LEGACY_USAGE_URL,
  CURSOR_SESSION_COOKIE,
  CURSOR_STATE_DB_SEGMENTS,
  CURSOR_TOKEN_SQL,
  CURSOR_USAGE_URL,
  PROVIDER_LABELS,
  type UsageSnapshot,
} from "@capsule/config";
import { RateLimitedError, retryAfterMs } from "../backoff.ts";
import { toPercent } from "../clamp.ts";
import { usageHeaders } from "../headers.ts";
import { resetIso } from "../reset.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface CursorPlan {
  used?: number | null;
  limit?: number | null;
  totalPercentUsed?: number | null;
}

interface CursorSummary {
  billingCycleEnd?: string | null;
  individualUsage?: {
    plan?: CursorPlan | null;
    overall?: CursorPlan | null;
  } | null;
}

/**
 * Cursor stores the token as a blob, so it is read back as hex to survive the
 * trip through the shell. Anything that is not hex is taken as the token.
 */
export function cursorTokenFromHex(output: string | null): string | null {
  const trimmed = output?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^[0-9a-fA-F]+$/.test(trimmed) || trimmed.length % 2 !== 0) {
    return trimmed;
  }
  const decoded = Buffer.from(trimmed, "hex").toString("utf8").trim();
  return decoded.length > 0 ? decoded : null;
}

/** The `sub` claim of a JWT, which Cursor uses as the user id. */
export function jwtSubject(token: string): string | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    return null;
  }
  try {
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof json.sub === "string" && json.sub.length > 0
      ? json.sub
      : null;
  } catch {
    return null;
  }
}

export function mapCursorUsage(
  payload: CursorSummary,
  fetchedAt: Date,
): UsageSnapshot {
  const plan =
    payload.individualUsage?.plan ?? payload.individualUsage?.overall;
  let percent: number | null = null;
  if (typeof plan?.totalPercentUsed === "number") {
    percent = toPercent(plan.totalPercentUsed);
  } else if (
    typeof plan?.used === "number" &&
    typeof plan?.limit === "number" &&
    plan.limit > 0
  ) {
    percent = toPercent((plan.used / plan.limit) * 100);
  }
  return {
    providerId: "cursor",
    displayName: PROVIDER_LABELS.cursor,
    iconId: "cursor",
    primaryPercent: percent,
    status: "ok",
    fetchedAt: fetchedAt.toISOString(),
    buckets:
      percent === null
        ? []
        : [
            {
              id: "plan",
              label: COPY.cursorPlan,
              percentUsed: percent,
              resetsAt: resetIso(payload.billingCycleEnd, fetchedAt),
              resetStyle: "absolute",
            },
          ],
  };
}

async function fetchSummary(
  context: UsageProviderContext,
  token: string,
  userId: string,
): Promise<Response> {
  const response = await context.fetch(CURSOR_USAGE_URL, {
    headers: usageHeaders({
      Cookie: `${CURSOR_SESSION_COOKIE}=${userId}%3A%3A${token}`,
    }),
  });
  if (response.ok || response.status === 401 || response.status === 403) {
    return response;
  }
  if (response.status === 429) {
    return response;
  }
  // The older endpoint takes the user id in the query and the token as a bearer.
  return context.fetch(
    `${CURSOR_LEGACY_USAGE_URL}?user=${encodeURIComponent(userId)}`,
    { headers: usageHeaders({ Authorization: `Bearer ${token}` }) },
  );
}

/**
 * Reads the editor's own session out of its state store and asks Cursor's
 * usage summary with it, the same request the editor's dashboard makes.
 */
export function createCursorProvider(): UsageProvider {
  return {
    id: "cursor",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const database = join(context.homeDir, ...CURSOR_STATE_DB_SEGMENTS);
      const output = await context.runCommand?.("sqlite3", [
        "-readonly",
        database,
        CURSOR_TOKEN_SQL,
      ]);
      const token = cursorTokenFromHex(output ?? null);
      const userId = token ? jwtSubject(token) : null;
      if (!token || !userId) {
        return unauthenticatedSnapshot("cursor", context.now);
      }
      const response = await fetchSummary(context, token, userId);
      if (response.status === 401 || response.status === 403) {
        return unauthenticatedSnapshot("cursor", context.now);
      }
      if (response.status === 429) {
        throw new RateLimitedError(
          retryAfterMs(response.headers.get("Retry-After"), context.now),
        );
      }
      if (!response.ok) {
        throw new Error(`Cursor usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as CursorSummary;
      return mapCursorUsage(payload, context.now);
    },
  };
}
