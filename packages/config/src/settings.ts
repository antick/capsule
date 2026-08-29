import { z } from "zod";
import {
  PLACEMENT_PRESETS,
  type PlacementPreset,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  type ProviderId,
} from "./constants.ts";

const LEGACY_PROVIDER_IDS: Record<string, ProviderId> = {
  chatgpt: "codex",
  spark: "grok",
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
  const firstLiveSchema = input.schemaVersion == null;
  return {
    ...input,
    enabledProviderIds: enabled,
    demoMode: firstLiveSchema ? false : input.demoMode,
    schemaVersion:
      typeof input.schemaVersion === "number" ? input.schemaVersion : 2,
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
    customPosition: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .nullable()
      .default(null),
    schemaVersion: z.number().int().positive().default(2),
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
    customPosition: null,
    schemaVersion: 2,
  };
}
