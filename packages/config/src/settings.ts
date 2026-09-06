import { z } from "zod";
import {
  DEFAULT_ENABLED_PROVIDER_IDS,
  HIDE_DELAY_IDS,
  PLACEMENT_PRESETS,
  type PlacementPreset,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  type ProviderId,
} from "./constants.ts";
import { CORNERS } from "./corner.ts";
import { DOCK_STYLE_IDS } from "./dock-style.ts";
import { clampHudScale, HUD_SCALE } from "./metrics.ts";
import { HUD_THEME_IDS } from "./theme.ts";

const SCHEMA_VERSION = 6;

export const USAGE_DISPLAYS = ["used", "remaining"] as const;
export type UsageDisplay = (typeof USAGE_DISPLAYS)[number];

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
    ? providerOrder(
        input.enabledProviderIds.map((id) => {
          if (typeof id !== "string") {
            return id;
          }
          return LEGACY_PROVIDER_IDS[id] ?? id;
        }),
      )
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
    // A stored position used to be the window's corner and is now the leading
    // edge of the rail itself, so an old coordinate would put the dock in the
    // wrong place. Let the placement engine re-anchor it instead.
    customPosition: version < 6 ? null : input.customPosition,
    // The artwork was redrawn at a smaller size, so an old percentage no
    // longer means what it did and is dropped rather than re-based. Anything
    // newer is snapped onto the current grid of sizes.
    hudScale:
      version < 5
        ? HUD_SCALE.default
        : typeof input.hudScale === "number"
          ? clampHudScale(input.hudScale)
          : input.hudScale,
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * The dock renders providers in one fixed order. Storing the enabled set in
 * whatever order it was toggled would let the dock re-shuffle itself the next
 * time settings were saved, so the set is kept sorted and de-duplicated.
 */
function providerOrder(ids: unknown[]): unknown[] {
  const wanted = new Set(ids);
  const sorted: unknown[] = PROVIDER_IDS.filter((id) => wanted.has(id));
  // Anything unrecognised is kept so the schema, not this, rejects it.
  return [
    ...sorted,
    ...ids.filter((id) => !PROVIDER_IDS.includes(id as never)),
  ];
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
    hudTheme: z
      .enum(["auto", ...HUD_THEME_IDS] as const)
      .default("auto")
      .catch("auto"),
    dockStyle: z.enum(DOCK_STYLE_IDS).default("rail").catch("rail"),
    /** Let the dock curl into a quarter arc when it reaches a screen corner. */
    cornerArc: z.boolean().default(false).catch(false),
    notificationPopups: z.boolean().default(true).catch(true),
    /** Rest as a latch in the screen edge until the pointer comes for it. */
    autoHide: z.boolean().default(true).catch(true),
    /** How long that latch waits after the pointer leaves before folding. */
    hideDelay: z.enum(HIDE_DELAY_IDS).default("normal").catch("normal"),
    /**
     * The corner the dock was dropped into, when the corner arc is on. Stored
     * rather than worked out from the position, so a rail that grows a ring
     * never curls into a corner by itself.
     */
    customCorner: z.enum(CORNERS).nullable().default(null).catch(null),
    /**
     * Draw the top edge as a notch: centred, straight-sided, rounded underneath,
     * resting as a notch-sized tab in the menu bar. On a MacBook display it
     * merges with the real notch; elsewhere it draws its own. Off, the top
     * dock is its own shape and slides along the edge like any other.
     */
    topEdgeNotch: z.boolean().default(true).catch(true),
    /**
     * Whether the rings, bars and percentages count what has been used or
     * what is left. The same numbers either way, read from the other end.
     */
    usageDisplay: z.enum(USAGE_DISPLAYS).default("used").catch("used"),
    customPosition: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .nullable()
      .default(null),
    schemaVersion: z.number().int().positive().default(SCHEMA_VERSION),
  }),
);

export type CapsuleSettings = z.infer<typeof settingsSchema>;

export function defaultSettings(): CapsuleSettings {
  return {
    placementPreset: "right-edge" satisfies PlacementPreset,
    enabledProviderIds: [...DEFAULT_ENABLED_PROVIDER_IDS] as ProviderId[],
    demoMode: false,
    pollIntervalMs: POLL_INTERVAL_MS,
    launchAtLogin: false,
    hudScale: HUD_SCALE.default,
    hudTheme: "auto",
    dockStyle: "rail",
    cornerArc: false,
    autoHide: true,
    notificationPopups: true,
    hideDelay: "normal",
    customCorner: null,
    topEdgeNotch: true,
    usageDisplay: "used",
    customPosition: null,
    schemaVersion: SCHEMA_VERSION,
  };
}
