export type HudAppearance = "light" | "dark";

export interface HudTheme {
  id: HudThemeId;
  label: string;
  hint: string;
  appearance: HudAppearance;
  /** Body fill of the rail and the card. */
  surface: string;
  /** Hairline drawn around the surface by outlined dock styles. */
  surfaceEdge: string;
  text: string;
  textMuted: string;
  /** Unfilled part of a meter ring. */
  ringTrack: string;
  /** Unfilled part of a card bar. */
  barTrack: string;
  /** Drop shadow colour, already carrying its own alpha. */
  shadow: string;
}

export const HUD_THEME_IDS = [
  "midnight",
  "graphite",
  "ink",
  "porcelain",
  "linen",
] as const;

export type HudThemeId = (typeof HUD_THEME_IDS)[number];

/** `auto` follows the system appearance; anything else pins one palette. */
export type HudThemeSetting = "auto" | HudThemeId;

export const HUD_THEMES = {
  midnight: {
    id: "midnight",
    label: "Midnight",
    hint: "True black, the way the dock was drawn.",
    appearance: "dark",
    surface: "#000000",
    surfaceEdge: "rgba(255, 255, 255, 0.10)",
    text: "#FFFFFF",
    textMuted: "#8C8C8C",
    ringTrack: "#303030",
    barTrack: "#2E2E2E",
    shadow: "rgba(0, 0, 0, 0.5)",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    hint: "Softer charcoal that sits gently on busy wallpaper.",
    appearance: "dark",
    surface: "#1C1C1E",
    surfaceEdge: "rgba(255, 255, 255, 0.14)",
    text: "#F5F5F7",
    textMuted: "#9A9AA1",
    ringTrack: "#3A3A3E",
    barTrack: "#3A3A3E",
    shadow: "rgba(0, 0, 0, 0.45)",
  },
  ink: {
    id: "ink",
    label: "Ink",
    hint: "Deep navy with a cool cast.",
    appearance: "dark",
    surface: "#0B1220",
    surfaceEdge: "rgba(126, 162, 255, 0.18)",
    text: "#E9EEFF",
    textMuted: "#7E8CAB",
    ringTrack: "#1E2A42",
    barTrack: "#1E2A42",
    shadow: "rgba(4, 10, 26, 0.55)",
  },
  porcelain: {
    id: "porcelain",
    label: "Porcelain",
    hint: "Clean white for light desktops.",
    appearance: "light",
    surface: "#FFFFFF",
    surfaceEdge: "rgba(0, 0, 0, 0.10)",
    text: "#111113",
    textMuted: "#6B6B70",
    ringTrack: "#E4E4E9",
    barTrack: "#E4E4E9",
    shadow: "rgba(0, 0, 0, 0.22)",
  },
  linen: {
    id: "linen",
    label: "Linen",
    hint: "Warm paper tone that stays quiet in daylight.",
    appearance: "light",
    surface: "#F7F3EB",
    surfaceEdge: "rgba(62, 48, 22, 0.12)",
    text: "#23201B",
    textMuted: "#7B7365",
    ringTrack: "#E3DBCB",
    barTrack: "#E3DBCB",
    shadow: "rgba(62, 48, 22, 0.2)",
  },
} as const satisfies Record<HudThemeId, HudTheme>;

/** Palettes `auto` picks between, one per system appearance. */
export const HUD_THEME_AUTO_PAIR = {
  dark: "midnight",
  light: "porcelain",
} as const satisfies Record<HudAppearance, HudThemeId>;

export function resolveHudTheme(
  setting: HudThemeSetting,
  systemAppearance: HudAppearance,
): HudTheme {
  if (setting === "auto") {
    return HUD_THEMES[HUD_THEME_AUTO_PAIR[systemAppearance]];
  }
  return HUD_THEMES[setting] ?? HUD_THEMES.midnight;
}
