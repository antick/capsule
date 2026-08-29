import { join } from "node:path";
import { COPY } from "@capsule/config";

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

export function resetIso(
  value: number | string | null | undefined,
  fallback: Date,
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 0 && value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === "string" && value.length > 0) {
    if (/^\d+(\.\d+)?$/.test(value)) {
      return resetIso(Number(value), fallback);
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return fallback.toISOString();
}

export function windowLabel(
  seconds: number | null | undefined,
  fallback: string,
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return fallback;
  }
  if (seconds <= 6 * HOUR_SECONDS) {
    return COPY.fiveHourWindow;
  }
  if (seconds <= 2 * DAY_SECONDS) {
    return COPY.dailyWindow;
  }
  if (seconds <= 10 * DAY_SECONDS) {
    return COPY.weeklyWindow;
  }
  return COPY.monthlyWindow;
}

export function credentialPath(
  homeDir: string,
  envName: string,
  segments: readonly string[],
): string {
  const override =
    typeof process !== "undefined" ? process.env[envName] : undefined;
  if (override && override.length > 0) {
    const leaf = segments[segments.length - 1] ?? "auth.json";
    return join(override, leaf);
  }
  return join(homeDir, ...segments);
}
