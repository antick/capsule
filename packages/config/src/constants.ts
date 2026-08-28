export const APP_NAME = "Capsule";

export const PROVIDER_IDS = ["claude", "chatgpt", "spark"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PLACEMENT_PRESETS = [
  "right-edge",
  "left-edge",
  "dock-flank-left",
  "dock-flank-right",
  "stage-manager-top",
  "stage-manager-bottom",
] as const;
export type PlacementPreset = (typeof PLACEMENT_PRESETS)[number];

export const SEVERITY_BANDS = {
  low: 39,
  mid: 69,
  high: 89,
  critical: 100,
} as const;

export const SEVERITY_COLORS = {
  low: "#34D399",
  mid: "#E8E04A",
  high: "#FF5A36",
  critical: "#EF4444",
} as const;

export type Severity = keyof typeof SEVERITY_COLORS;

export const HUD = {
  surface: "#0A0A0A",
  text: "#FFFFFF",
  textMuted: "#9A9A9A",
  ringTrack: "#2C2C2C",
  barTrack: "#2C2C2C",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  railWidth: 76,
  railPaddingX: 14,
  railPaddingY: 20,
  meterSize: 48,
  ringStroke: 3.25,
  itemGap: 20,
  percentFontSize: 12,
  cardWidth: 304,
  cardPadding: 16,
  cardRadius: 22,
  railRadius: 28,
  joinSize: 14,
  shadowPadding: 20,
  hoverOpenDelayMs: 80,
  hoverCloseDelayMs: 180,
  meterCountDefault: 3,
} as const;

export const PLACEMENT = {
  gutterInsetPx: 0,
  stageManagerStripWidthPx: 180,
  stageManagerThumbStackInsetPx: 96,
  dockFlankMarginPx: 16,
  dockCenteredIconSpanPx: 420,
  windowShadowPaddingPx: 20,
} as const;

export const POLL_INTERVAL_MS = 60_000;
export const CHROME_POLL_MS = 2_000;

export const ANTHROPIC_OAUTH_USAGE_URL =
  "https://api.anthropic.com/api/oauth/usage";
export const ANTHROPIC_OAUTH_BETA_HEADER = "oauth-2025-04-20";
export const CHATGPT_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export const CLAUDE_CREDENTIALS_PATH_SEGMENTS = [
  ".claude",
  ".credentials.json",
] as const;
export const CODEX_AUTH_PATH_SEGMENTS = [".codex", "auth.json"] as const;

export const IPC = {
  snapshots: "capsule:snapshots",
  getSettings: "capsule:get-settings",
  getSnapshots: "capsule:get-snapshots",
  setSettings: "capsule:set-settings",
  openSettings: "capsule:open-settings",
  quit: "capsule:quit",
  setPointerCapture: "capsule:set-pointer-capture",
  setExpanded: "capsule:set-expanded",
  contextMenu: "capsule:context-menu",
} as const;

export const COPY = {
  currentSession: "Current session",
  allModels: "All models",
  chatgptPrimary: "Primary window",
  chatgptSecondary: "Secondary window",
  sparkPrimary: "Current window",
  sparkSecondary: "Weekly",
  percentUsedSuffix: "% Used",
  percentSuffix: "%",
  usageTitleSuffix: " Usage",
  notConnected: "Not connected",
  staleData: "Data is stale",
  unavailable: "Usage unavailable",
  settings: "Settings",
  quit: "Quit Capsule",
  demoMode: "Demo mode",
  launchAtLogin: "Launch at login",
  pollInterval: "Refresh interval (ms)",
  placement: "Placement",
  providers: "Providers",
  onboardingTitle: "Welcome to Capsule",
  onboardingBody:
    "Connect Claude or ChatGPT from credentials already on this Mac, or turn on demo mode to see the usage dock.",
  enableDemo: "Enable demo mode",
} as const;
