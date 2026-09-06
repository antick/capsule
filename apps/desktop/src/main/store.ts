import type { TokenFileCache } from "@capsule/activity/tokens";
import {
  type CapsuleSettings,
  defaultSettings,
  PROVIDER_IDS,
  settingsSchema,
  type UsageSnapshot,
} from "@capsule/config";
import Store from "electron-store";

const store = new Store<{
  settings?: unknown;
  /** Rate-limit penalties by provider, as the epoch millisecond each ends. */
  backoff?: Record<string, number>;
}>({ name: "capsule-settings" });

export function loadBackoff(): Record<string, number> {
  const raw = store.get("backoff");
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

export function saveBackoff(until: Record<string, number>): void {
  store.set("backoff", until);
}

/**
 * The readings themselves, so the dock has numbers the moment it appears.
 * Their own file: they change every poll, and the settings file should not.
 */
const readings = new Store<{ snapshots?: unknown; tokenCache?: unknown }>({
  name: "capsule-readings",
});

export function loadSnapshots(): UsageSnapshot[] {
  const raw = readings.get("snapshots");
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (item): item is UsageSnapshot =>
      !!item &&
      typeof item === "object" &&
      PROVIDER_IDS.includes((item as UsageSnapshot).providerId) &&
      Array.isArray((item as UsageSnapshot).buckets) &&
      typeof (item as UsageSnapshot).fetchedAt === "string",
  );
}

export function saveSnapshots(snapshots: UsageSnapshot[]): void {
  readings.set("snapshots", snapshots);
}

export function loadTokenCache(): TokenFileCache {
  const raw = readings.get("tokenCache");
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as TokenFileCache)
    : {};
}

export function saveTokenCache(cache: TokenFileCache): void {
  readings.set("tokenCache", cache);
}

export function loadSettings(): CapsuleSettings {
  const raw = store.get("settings");
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fallback = defaultSettings();
    store.set("settings", fallback);
    return fallback;
  }
  const settings = parsed.data;
  if (needsPersist(raw, settings)) {
    store.set("settings", settings);
  }
  return settings;
}

function needsPersist(raw: unknown, settings: CapsuleSettings): boolean {
  if (!raw || typeof raw !== "object") {
    return true;
  }
  const input = raw as Record<string, unknown>;
  return (
    input.schemaVersion !== settings.schemaVersion ||
    input.demoMode !== settings.demoMode ||
    JSON.stringify(input.enabledProviderIds) !==
      JSON.stringify(settings.enabledProviderIds)
  );
}

export function saveSettings(settings: CapsuleSettings): CapsuleSettings {
  const parsed = settingsSchema.parse(settings);
  store.set("settings", parsed);
  return parsed;
}
