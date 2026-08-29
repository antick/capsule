export const APP_NAME = "Capsule";

export const PROVIDER_IDS = ["claude", "codex", "grok"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok",
} as const satisfies Record<ProviderId, string>;

export const PLACEMENT_PRESETS = [
  "right-edge",
  "left-edge",
  "top-edge",
  "bottom-edge",
  "dock-flank-left",
  "dock-flank-right",
  "stage-manager-top",
  "stage-manager-bottom",
] as const;
export type PlacementPreset = (typeof PLACEMENT_PRESETS)[number];

export const PLACEMENT_LABELS = {
  "right-edge": "Right side",
  "left-edge": "Left side",
  "bottom-edge": "Bottom",
  "top-edge": "Top",
  "dock-flank-left": "Dock, left",
  "dock-flank-right": "Dock, right",
  "stage-manager-top": "Stage Manager, top",
  "stage-manager-bottom": "Stage Manager, bottom",
} as const satisfies Record<PlacementPreset, string>;

export const PLACEMENT_MENU_GROUPS = [
  ["right-edge", "left-edge", "bottom-edge", "top-edge"],
  ["dock-flank-left", "dock-flank-right"],
  ["stage-manager-top", "stage-manager-bottom"],
] as const satisfies ReadonlyArray<ReadonlyArray<PlacementPreset>>;

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
  railPaddingY: 32,
  meterSize: 48,
  ringStroke: 3.5,
  itemGap: 18,
  percentFontSize: 12,
  percentBlock: 18,
  iconSize: 18,
  meterLabelGap: 6,
  cardWidth: 304,
  cardPadding: 16,
  cardRadius: 22,
  cardHeight: 188,
  cardCompactHeight: 96,
  cardSingleHeight: 136,
  cardTitleSize: 14,
  cardLabelSize: 12,
  cardResetSize: 11,
  cardSectionGap: 14,
  barHeight: 5,
  railRadius: 32,
  joinWidth: 14,
  tailBase: 36,
  tailControl: 10,
  biteRadius: 24,
  connectorRadius: 0,
  blobBlur: 0,
  blobGooAlpha: 36,
  blobGooBias: -16,
  cardTailOffsetY: 56,
  shadowPadding: 24,
  hoverOpenDelayMs: 70,
  hoverCloseDelayMs: 220,
  meterCountDefault: 3,
} as const;

export const MOTION = {
  cardMs: 280,
  blobMs: 280,
  ringMs: 560,
  barMs: 420,
  meterMs: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  snapDistancePx: 72,
  dragThresholdPx: 6,
  dragPollMs: 8,
  meterHoverScale: 1.06,
  closedCardShiftPx: 16,
  closedCardScale: 0.94,
  liftScale: 1.03,
  shadowDy: 14,
  shadowBlur: 18,
  shadowOpacity: 0.42,
  railShadow: "0 14px 40px rgba(0, 0, 0, 0.42)",
} as const;

export function meterBlockSize(): number {
  return HUD.meterSize + HUD.itemGap + HUD.percentBlock;
}

export function railLengthForCount(count: number): number {
  const n = Math.max(1, count);
  return HUD.railPaddingY * 2 + n * meterBlockSize() - HUD.itemGap;
}

export function joinOffsetForIndex(index: number): number {
  return HUD.railPaddingY + index * meterBlockSize() + HUD.meterSize / 2;
}

export const PLACEMENT = {
  gutterInsetPx: 0,
  stageManagerStripWidthPx: 180,
  stageManagerThumbStackInsetPx: 96,
  dockFlankMarginPx: 16,
  dockCenteredIconSpanPx: 420,
  windowShadowPaddingPx: 24,
} as const;

export const POLL_INTERVAL_MS = 60_000;
export const CHROME_POLL_MS = 2_000;

export const ANTHROPIC_OAUTH_USAGE_URL =
  "https://api.anthropic.com/api/oauth/usage";
export const ANTHROPIC_OAUTH_BETA_HEADER = "oauth-2025-04-20";
export const CLAUDE_KEYCHAIN_SERVICE = "Claude Code-credentials";
export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const CODEX_USAGE_FALLBACK_URL =
  "https://chatgpt.com/backend-api/codex/usage";
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const CODEX_OAUTH_CLIENT_ID = "app_EMohtA1zFfdvkohgPldNB5nP";
export const GROK_BILLING_URL =
  "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
export const GROK_TOKEN_AUTH_VALUE = "xai-grok-cli";
export const GROK_USER_ID_HEADER = "x-userid";
export const USAGE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Capsule/0.1";
export const CLAUDE_USAGE_CACHE_FILE = ".claude.json";

export const CLAUDE_CREDENTIALS_PATH_SEGMENTS = [
  ".claude",
  ".credentials.json",
] as const;
export const CODEX_AUTH_PATH_SEGMENTS = [".codex", "auth.json"] as const;
export const GROK_AUTH_PATH_SEGMENTS = [".grok", "auth.json"] as const;
export const CODEX_HOME_ENV = "CODEX_HOME";
export const GROK_HOME_ENV = "GROK_HOME";

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
  startMove: "capsule:start-move",
  moveWindow: "capsule:move-window",
  endMove: "capsule:end-move",
} as const;

export const COPY = {
  currentSession: "Current session",
  allModels: "All models",
  fiveHourWindow: "5-hour window",
  weeklyWindow: "Weekly",
  dailyWindow: "Daily",
  monthlyWindow: "Monthly",
  grokWeekly: "Weekly credits",
  grokOnDemand: "On-demand",
  grokBuild: "Grok Build",
  percentUsedSuffix: "% Used",
  percentSuffix: "%",
  usageTitleSuffix: " Usage",
  notConnected: "Not connected",
  staleData: "Data is stale",
  unavailable: "Usage unavailable",
  settings: "Settings",
  openSettings: "Open Settings…",
  position: "Position",
  quit: "Quit Capsule",
  demoMode: "Demo mode",
  launchAtLogin: "Launch at login",
  pollInterval: "Refresh interval (ms)",
  placement: "Placement",
  providers: "Providers",
  onboardingTitle: "Welcome to Capsule",
  onboardingBody:
    "Capsule reads Claude, Codex, and Grok logins already on this Mac. Sign in with those CLIs, or turn on demo mode to preview the dock.",
  enableDemo: "Enable demo mode",
} as const;
