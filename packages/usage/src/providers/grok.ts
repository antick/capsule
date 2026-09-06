import {
  COPY,
  GROK_AUTH_PATH_SEGMENTS,
  GROK_BILLING_URL,
  GROK_HOME_ENV,
  GROK_TOKEN_AUTH_VALUE,
  GROK_USER_ID_HEADER,
  PROVIDER_LABELS,
  type UsageBucket,
  type UsageSnapshot,
} from "@capsule/config";
import { toPercent } from "../clamp.ts";
import { usageHeaders } from "../headers.ts";
import { credentialPath, resetIso } from "../reset.ts";
import type { UsageProvider, UsageProviderContext } from "../types.ts";
import { unauthenticatedSnapshot } from "../unauthenticated.ts";

interface GrokPeriod {
  type?: string;
  start?: string;
  end?: string;
}

interface GrokAmount {
  val?: number | string;
}

interface GrokProductUsage {
  product?: string;
  usagePercent?: number;
}

interface GrokCreditsConfig {
  creditUsagePercent?: number;
  currentPeriod?: GrokPeriod;
  billingPeriodEnd?: string;
  onDemandCap?: GrokAmount;
  onDemandUsed?: GrokAmount;
  productUsage?: GrokProductUsage[];
}

interface GrokBillingResponse {
  config?: GrokCreditsConfig;
  creditUsagePercent?: number;
}

function isLikelyJwt(value: string): boolean {
  return value.startsWith("eyJ") && value.split(".").length >= 3;
}

function isExpired(record: Record<string, unknown>): boolean {
  const expires = record.expires_at ?? record.expiresAt ?? record.expires;
  if (typeof expires === "number") {
    const ms = expires < 1e12 ? expires * 1000 : expires;
    return ms > 0 && ms < Date.now() - 30_000;
  }
  if (typeof expires === "string" && expires.length > 0) {
    const date = new Date(expires);
    return (
      !Number.isNaN(date.getTime()) && date.getTime() < Date.now() - 30_000
    );
  }
  return false;
}

interface GrokAuthToken {
  token: string;
  expired: boolean;
  userId: string | null;
}

function readUserId(record: Record<string, unknown>): string | null {
  for (const key of ["user_id", "userId", "principal_id", "sub"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function collectTokens(value: unknown, into: GrokAuthToken[]): void {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTokens(item, into);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const expired = isExpired(record);
  const userId = readUserId(record);
  for (const key of ["key", "access_token", "accessToken"] as const) {
    const token = record[key];
    if (typeof token === "string" && isLikelyJwt(token)) {
      into.push({ token, expired, userId });
    }
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key === "key" || key === "access_token" || key === "accessToken") {
      continue;
    }
    collectTokens(nested, into);
  }
}

export function grokAuthFromFile(raw: string): {
  token: string;
  userId: string | null;
} | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const tokens: GrokAuthToken[] = [];
    collectTokens(parsed, tokens);
    const preferred = tokens.find((item) => !item.expired) ?? tokens[0];
    return preferred
      ? { token: preferred.token, userId: preferred.userId }
      : null;
  } catch {
    const token = raw.trim();
    return isLikelyJwt(token) ? { token, userId: null } : null;
  }
}

export function grokTokenFromFile(raw: string): string | null {
  return grokAuthFromFile(raw)?.token ?? null;
}

function amountValue(amount: GrokAmount | undefined): number | null {
  if (amount?.val == null) {
    return null;
  }
  const value = Number(amount.val);
  return Number.isFinite(value) ? value : null;
}

function productLabel(product: string | undefined): string {
  if (!product) {
    return COPY.grokBuild;
  }
  const normalized = product.replace(/^PRODUCT_/i, "").replace(/_/g, " ");
  if (/build/i.test(normalized)) {
    return COPY.grokBuild;
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mapGrokCredits(
  payload: GrokBillingResponse,
  fetchedAt: Date,
): UsageSnapshot {
  const config = payload.config ?? {};
  const weeklyPercent = toPercent(
    config.creditUsagePercent ?? payload.creditUsagePercent,
  );
  const resetsAt = resetIso(
    config.currentPeriod?.end ?? config.billingPeriodEnd,
    fetchedAt,
  );
  const buckets: UsageBucket[] = [
    {
      id: "weekly",
      label: COPY.grokWeekly,
      percentUsed: weeklyPercent,
      resetsAt,
      resetStyle: "absolute",
    },
  ];
  const products = (config.productUsage ?? []).filter(
    (item) => typeof item.usagePercent === "number",
  );
  const build = products.find((item) => /build/i.test(item.product ?? ""));
  const extra = build ?? products[0];
  // xAI reports the headline credit percent again as a product row; skip the echo.
  if (
    extra &&
    extra.usagePercent != null &&
    toPercent(extra.usagePercent) !== weeklyPercent
  ) {
    buckets.push({
      id: "product",
      label: productLabel(extra.product),
      percentUsed: toPercent(extra.usagePercent),
      resetsAt,
      resetStyle: "absolute",
    });
  } else {
    const cap = amountValue(config.onDemandCap);
    const used = amountValue(config.onDemandUsed);
    if (cap && cap > 0 && used != null) {
      buckets.push({
        id: "on-demand",
        label: COPY.grokOnDemand,
        percentUsed: toPercent((used / cap) * 100),
        resetsAt,
        resetStyle: "absolute",
      });
    }
  }
  return {
    providerId: "grok",
    displayName: PROVIDER_LABELS.grok,
    iconId: "grok",
    primaryPercent: weeklyPercent,
    status: "ok",
    fetchedAt: fetchedAt.toISOString(),
    buckets,
  };
}

export function createGrokProvider(): UsageProvider {
  return {
    id: "grok",
    fetchSnapshot: async (context: UsageProviderContext) => {
      const authPath = credentialPath(
        context.homeDir,
        GROK_HOME_ENV,
        GROK_AUTH_PATH_SEGMENTS,
      );
      const raw = await context.readFile(authPath);
      const auth = raw ? grokAuthFromFile(raw) : null;
      if (!auth) {
        return unauthenticatedSnapshot("grok", context.now);
      }
      const headers = usageHeaders({
        Authorization: `Bearer ${auth.token}`,
        "X-XAI-Token-Auth": GROK_TOKEN_AUTH_VALUE,
      });
      if (auth.userId) {
        headers[GROK_USER_ID_HEADER] = auth.userId;
      }
      const response = await context.fetch(GROK_BILLING_URL, {
        headers,
      });
      if (response.status === 401 || response.status === 403) {
        return unauthenticatedSnapshot("grok", context.now);
      }
      if (!response.ok) {
        throw new Error(`Grok usage HTTP ${response.status}`);
      }
      const payload = (await response.json()) as GrokBillingResponse;
      return mapGrokCredits(payload, context.now);
    },
  };
}
