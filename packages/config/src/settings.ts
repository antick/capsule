import { z } from "zod";
import {
  PLACEMENT_PRESETS,
  type PlacementPreset,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  type ProviderId,
} from "./constants.ts";
import { clampHudScale, HUD_SCALE } from "./metrics.ts";

const LEGACY_PROVIDER_IDS: Record<string, ProviderId> = {
  chatgpt: "codex",
  spark: "grok",
};

/**
 * Placement used to carry Dock-flank and Stage Manager variants. Both were
 * really just "an edge", so they collapse onto the edge they sat closest to.
 */
const LEGACY_PLACEMENT_PRESETS: Record<string, PlacementPreset> = {
  "dock-flank-left": "bottom-edge",
  "dock-flank-right": "bottom-edge",
  "stage-manager-top": "left-edge",
  "stage-manager-bottom": "left-edge",
};

export function migrateSettings(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const input = raw as Record<string, unknown>;
  const enabled = Array.isArray(input.enabledProviderIds)
    ? input.enabledProviderIds.map((id) => {
        if (typeof id !== "string") {
          return id;
        }
        return LEGACY_PROVIDER_IDS[id] ?? id;
      })
    : input.enabledProviderIds;
  const preset =
    typeof input.placementPreset === "string"
      ? (LEGACY_PLACEMENT_PRESETS[input.placementPreset] ??
        input.placementPreset)
      : input.placementPreset;
  const firstLiveSchema = input.schemaVersion == null;
  const version =
    typeof input.schemaVersion === "number" ? input.schemaVersion : 2;
  return {
    ...input,
    enabledProviderIds: enabled,
    placementPreset: preset,
    demoMode: firstLiveSchema ? false : input.demoMode,
    // A stored position belongs to the old placement model; let the new
    // engine re-anchor the dock rather than restoring a stale coordinate.
    customPosition: version < 3 ? null : input.customPosition,
    hudScale:
      typeof input.hudScale === "number"
        ? clampHudScale(input.hudScale)
        : HUD_SCALE.default,
    schemaVersion: 3,
  };
}

export const settingsSchema = z.preprocess(
  migrateSettings,
  z.object({
    placementPreset: z.enum(PLACEMENT_PRESETS),
    enabledProviderIds: z.array(z.enum(PROVIDER_IDS)).min(0),
    demoMode: z.boolean(),
    pollIntervalMs: z.number().int().positive(),
    launchAtLogin: z.boolean(),
    hudScale: z
      .number()
      .min(HUD_SCALE.min)
      .max(HUD_SCALE.max)
      .default(HUD_SCALE.default),
    customPosition: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .nullable()
      .default(null),
    schemaVersion: z.number().int().positive().default(3),
  }),
);

export type CapsuleSettings = z.infer<typeof settingsSchema>;

export function defaultSettings(): CapsuleSettings {
  return {
    placementPreset: "right-edge" satisfies PlacementPreset,
    enabledProviderIds: [...PROVIDER_IDS] as ProviderId[],
    demoMode: false,
    pollIntervalMs: POLL_INTERVAL_MS,
    launchAtLogin: false,
    hudScale: HUD_SCALE.default,
    customPosition: null,
    schemaVersion: 3,
  };
}
