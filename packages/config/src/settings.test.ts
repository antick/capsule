import { describe, expect, it } from "vitest";
import { HUD_SCALE } from "./metrics.ts";
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
    expect(migrated.schemaVersion).toBe(6);
  });

  it("sorts the enabled providers so the dock cannot re-shuffle itself", () => {
    // Toggling one back on used to append it, and the dock draws them in the
    // stored order — so saving settings could reorder the rings.
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      enabledProviderIds: ["grok", "claude"],
    });
    expect(migrated.enabledProviderIds).toEqual(["claude", "grok"]);
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

  it("drops a position saved before it meant the rail's own edge", () => {
    // It used to be the window's corner, which sits a shadow gutter and half
    // the card's overhang away from where the dock is drawn.
    for (const schemaVersion of [2, 5]) {
      const migrated = settingsSchema.parse({
        ...defaultSettings(),
        customPosition: { x: 900, y: 120 },
        schemaVersion,
      });
      expect(migrated.customPosition).toBeNull();
    }
  });

  it("keeps a position saved under the current model", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      customPosition: { x: 900, y: 120 },
      schemaVersion: 6,
    });
    expect(migrated.customPosition).toEqual({ x: 900, y: 120 });
  });

  it("snaps a stored size onto the sizes the stepper can reach", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      hudScale: 0.55,
      schemaVersion: 5,
    });
    expect(migrated.hudScale).toBe(HUD_SCALE.min);
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

  it("forgets a size chosen against the older, larger artwork", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      hudScale: 1.25,
      schemaVersion: 4,
    });
    expect(migrated.hudScale).toBe(HUD_SCALE.default);
  });

  it("keeps a size chosen against the current artwork", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      hudScale: 1.2,
      schemaVersion: 5,
    });
    expect(migrated.hudScale).toBe(1.2);
  });

  it("defaults the theme and dock style for older settings", () => {
    const migrated = settingsSchema.parse({
      ...defaultSettings(),
      hudTheme: undefined,
      dockStyle: undefined,
      schemaVersion: 3,
    });
    expect(migrated.hudTheme).toBe("auto");
    expect(migrated.dockStyle).toBe("rail");
  });
});

describe("usage display", () => {
  it("counts what was used unless told otherwise, and shrugs at nonsense", () => {
    expect(defaultSettings().usageDisplay).toBe("used");
    const parsed = settingsSchema.parse({
      ...defaultSettings(),
      usageDisplay: "remaining",
    });
    expect(parsed.usageDisplay).toBe("remaining");
    expect(
      settingsSchema.parse({ ...defaultSettings(), usageDisplay: "sideways" })
        .usageDisplay,
    ).toBe("used");
  });

  it("leaves the editor-backed providers off until asked for", () => {
    expect(defaultSettings().enabledProviderIds).toEqual([
      "claude",
      "codex",
      "grok",
    ]);
  });
});

describe("latch settings", () => {
  it("defaults to a normal hide delay and no remembered corner", () => {
    expect(defaultSettings().hideDelay).toBe("normal");
    expect(defaultSettings().customCorner).toBeNull();
    expect(
      settingsSchema.parse({ ...defaultSettings(), hideDelay: "yesterday" })
        .hideDelay,
    ).toBe("normal");
    expect(
      settingsSchema.parse({ ...defaultSettings(), customCorner: "top-right" })
        .customCorner,
    ).toBe("top-right");
  });
});

it("defaults notification popups on and preserves an explicit off preference", () => {
  const settings = defaultSettings();
  expect(settings.notificationPopups).toBe(true);
  const { notificationPopups: _omitted, ...old } = settings;
  expect(settingsSchema.parse(old).notificationPopups).toBe(true);
  expect(
    settingsSchema.parse({ ...settings, notificationPopups: false })
      .notificationPopups,
  ).toBe(false);
});
