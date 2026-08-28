import {
  type CapsuleSettings,
  defaultSettings,
  settingsSchema,
} from "@capsule/config";
import Store from "electron-store";

const store = new Store<{ settings?: unknown }>({ name: "capsule-settings" });

export function loadSettings(): CapsuleSettings {
  const parsed = settingsSchema.safeParse(store.get("settings"));
  if (parsed.success) {
    return parsed.data;
  }
  const fallback = defaultSettings();
  store.set("settings", fallback);
  return fallback;
}

export function saveSettings(settings: CapsuleSettings): CapsuleSettings {
  const parsed = settingsSchema.parse(settings);
  store.set("settings", parsed);
  return parsed;
}
