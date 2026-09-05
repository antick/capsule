import {
  type CapsuleSettings,
  defaultSettings,
  settingsSchema,
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
