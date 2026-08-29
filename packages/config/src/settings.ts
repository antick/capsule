import { z } from "zod";
import {
  PLACEMENT_PRESETS,
  type PlacementPreset,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  type ProviderId,
} from "./constants.ts";

export const settingsSchema = z.object({
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
});

export type CapsuleSettings = z.infer<typeof settingsSchema>;

export function defaultSettings(): CapsuleSettings {
  return {
    placementPreset: "right-edge" satisfies PlacementPreset,
    enabledProviderIds: [...PROVIDER_IDS] as ProviderId[],
    demoMode: true,
    pollIntervalMs: POLL_INTERVAL_MS,
    launchAtLogin: false,
    customPosition: null,
  };
}
