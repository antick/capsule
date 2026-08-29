import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  migrateSettings,
  settingsSchema,
} from "./settings.ts";

describe("migrateSettings", () => {
  it("maps legacy provider ids and turns demo off once", () => {
    const migrated = settingsSchema.parse(
      migrateSettings({
        placementPreset: "left-edge",
        enabledProviderIds: ["claude", "chatgpt", "spark"],
        demoMode: true,
        pollIntervalMs: 60_000,
        launchAtLogin: false,
        customPosition: null,
      }),
    );
    expect(migrated.enabledProviderIds).toEqual(["claude", "codex", "grok"]);
    expect(migrated.demoMode).toBe(false);
    expect(migrated.schemaVersion).toBe(2);
  });

  it("keeps an explicit demo toggle after migration", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      demoMode: true,
      schemaVersion: 2,
    });
    expect(migrated.demoMode).toBe(true);
  });
});
