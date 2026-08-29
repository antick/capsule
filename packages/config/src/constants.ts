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
  low: "#00F58A",
  mid: "#E8F50A",
  high: "#FA4405",
  critical: "#FF2D1F",
} as const;

export type Severity = keyof typeof SEVERITY_COLORS;

export const HUD = {
  surface: "#000000",
  text: "#FFFFFF",
  textMuted: "#8C8C8C",
  ringTrack: "#303030",
  barTrack: "#2E2E2E",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  railWidth: 95,
  railPaddingX: 18,
  railPaddingY: 38,
  railRadius: 47,
  // Concave fillet that blends the rail into the screen edge it sits against.
  edgeFlare: 48,
  meterSize: 58,
  ringStroke: 6,
  iconSize: 24,
  meterLabelGap: 18,
  percentBlock: 18,
  percentFontSize: 18,
  itemGap: 47,
  cardWidth: 307,
  cardRadius: 22,
  cardPaddingX: 16,
  cardPaddingTop: 14,
  cardPaddingBottom: 16,
  cardTitleSize: 17,
  cardTitleLine: 22,
  cardTitleGap: 14,
  cardIconSize: 26,
  cardIconGap: 10,
  cardLabelSize: 12,
  cardResetSize: 12,
  cardResetGap: 12,
  cardTextLine: 17,
  cardBucketGap: 6,
  cardSectionGap: 12,
  barHeight: 7,
  // Speech-bubble tail: a pointed spur that stops short of the rail.
  tailBase: 60,
  tailLength: 37,
  joinGap: 16,
  shadowPadding: 26,
  hoverOpenDelayMs: 70,
  hoverCloseDelayMs: 220,
  meterCountDefault: 3,
} as const;

export const MOTION = {
  openMs: 260,
  closeMs: 170,
  slideMs: 320,
  ringMs: 560,
  barMs: 420,
  meterMs: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  // Slight overshoot so the bubble pops out of the dock.
  popEasing: "cubic-bezier(0.18, 0.89, 0.32, 1.15)",
  closeEasing: "cubic-bezier(0.4, 0, 0.9, 0.6)",
  snapDistancePx: 72,
  dragThresholdPx: 5,
  dragPollMs: 8,
  meterIdleOpacity: 0.92,
  closedBubbleScale: 0.62,
  liftScale: 1.04,
  shadowDy: 12,
  shadowBlur: 22,
  shadowOpacity: 0.5,
} as const;

export function meterBlockSize(): number {
  return HUD.meterSize + HUD.meterLabelGap + HUD.percentBlock;
}

export function meterStrideSize(): number {
  return meterBlockSize() + HUD.itemGap;
}

export function railLengthForCount(count: number): number {
  const n = Math.max(1, count);
  return HUD.railPaddingY * 2 + n * meterBlockSize() + (n - 1) * HUD.itemGap;
}

export function joinOffsetForIndex(index: number): number {
  return HUD.railPaddingY + index * meterStrideSize() + HUD.meterSize / 2;
}

export function cardHeightForBuckets(count: number): number {
  const rows = Math.max(1, count);
  const bucket = HUD.cardTextLine * 2 + HUD.cardBucketGap * 2 + HUD.barHeight;
  return (
    HUD.cardPaddingTop +
    HUD.cardTitleLine +
    HUD.cardTitleGap +
    rows * bucket +
    (rows - 1) * HUD.cardSectionGap +
    HUD.cardPaddingBottom
  );
}

export function cardMessageHeight(): number {
  return (
    HUD.cardPaddingTop +
    HUD.cardTitleLine +
    HUD.cardTitleGap +
    HUD.cardTextLine +
    HUD.cardPaddingBottom
  );
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
