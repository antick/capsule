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
    expect(migrated.schemaVersion).toBe(3);
  });

  it("keeps an explicit demo toggle after migration", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      demoMode: true,
      schemaVersion: 2,
    });
    expect(migrated.demoMode).toBe(true);
  });

  it("folds retired placement presets onto the edge they sat on", () => {
    const flank = settingsSchema.parse({
      ...defaultSettings(),
      placementPreset: "dock-flank-right",
      schemaVersion: 2,
    });
    expect(flank.placementPreset).toBe("bottom-edge");

    const stage = settingsSchema.parse({
      ...defaultSettings(),
      placementPreset: "stage-manager-top",
      schemaVersion: 2,
    });
    expect(stage.placementPreset).toBe("left-edge");
  });

  it("drops a position saved under the old placement model", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      customPosition: { x: 900, y: 120 },
      schemaVersion: 2,
    });
    expect(migrated.customPosition).toBeNull();
  });

  it("keeps a position saved under the current model", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      customPosition: { x: 900, y: 120 },
      schemaVersion: 3,
    });
    expect(migrated.customPosition).toEqual({ x: 900, y: 120 });
  });

  it("fills in a default size for settings written before it existed", () => {
    const migrated = settingsSchema.parse({
      placementPreset: "right-edge",
      enabledProviderIds: ["claude"],
      demoMode: false,
      pollIntervalMs: 60_000,
      launchAtLogin: false,
      customPosition: null,
      schemaVersion: 2,
    });
    expect(migrated.hudScale).toBeGreaterThan(0);
  });
});
