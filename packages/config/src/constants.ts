export const APP_NAME = "Capsule";

export const PROVIDER_IDS = ["claude", "codex", "grok"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok",
} as const satisfies Record<ProviderId, string>;

/**
 * The dock always rides a screen edge. Dragging it re-docks to whichever edge
 * the cursor is nearest, so these four presets are the whole placement model.
 */
export const PLACEMENT_PRESETS = [
  "right-edge",
  "left-edge",
  "top-edge",
  "bottom-edge",
] as const;
export type PlacementPreset = (typeof PLACEMENT_PRESETS)[number];

export const PLACEMENT_LABELS = {
  "right-edge": "Right edge",
  "left-edge": "Left edge",
  "bottom-edge": "Bottom, beside the Dock",
  "top-edge": "Top, as a notch",
} as const satisfies Record<PlacementPreset, string>;

export const PLACEMENT_HINTS = {
  "right-edge": "Slides up and down the right side of the screen.",
  "left-edge": "Slides up and down the left side of the screen.",
  "bottom-edge": "Sits level with the macOS Dock so you can park it alongside.",
  "top-edge": "Hangs from the menu bar like the MacBook notch.",
} as const satisfies Record<PlacementPreset, string>;

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

/** Colours, type family and timings: never scaled with the dock. */
export const HUD = {
  surface: "#000000",
  text: "#FFFFFF",
  textMuted: "#8C8C8C",
  ringTrack: "#303030",
  barTrack: "#2E2E2E",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  hoverOpenDelayMs: 70,
  hoverCloseDelayMs: 220,
  meterCountDefault: 3,
} as const;

/**
 * Every dimension of the dock at scale 1, measured from the reference design.
 * Read these through `hudMetrics(scale)` rather than directly, so the user's
 * size preference reaches all of them.
 */
export const HUD_BASE = {
  railWidth: 95,
  railPaddingX: 18,
  railPaddingY: 26,
  railRadius: 47,
  // Concave fillet that blends the rail into the screen edge it sits against.
  edgeFlare: 48,
  meterSize: 58,
  ringStroke: 6,
  iconSize: 24,
  meterLabelGap: 14,
  percentBlock: 18,
  percentFontSize: 18,
  itemGap: 30,
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
  notchRadius: 26,
  notchPaddingY: 16,
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
  dragThresholdPx: 5,
  dragPollMs: 8,
  /**
   * How often the main process asks where the cursor is to decide whether the
   * overlay should swallow mouse events. macOS only forwards move events to a
   * click-through window while the app is frontmost, so hit testing cannot
   * live in the renderer.
   */
  hoverPollMs: 24,
  /** Slack around the dock so the hover region is forgiving at small sizes. */
  hoverSlopPx: 2,
  meterIdleOpacity: 0.92,
  closedBubbleScale: 0.62,
  liftScale: 1.04,
  shadowDy: 12,
  shadowBlur: 22,
  shadowOpacity: 0.5,
} as const;

export const PLACEMENT = {
  /**
   * Widest the macOS Dock is assumed to be. The bottom preset parks the HUD
   * outside this centred span so the two never overlap.
   */
  dockCenteredIconSpanPx: 420,
  /** Breathing room between the HUD and the Dock when they share the bottom. */
  dockFlankMarginPx: 12,
  /** Keeps the notch clear of the camera housing on notched displays. */
  notchSideInsetPx: 8,
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
  setHitRegions: "capsule:set-hit-regions",
  setExpanded: "capsule:set-expanded",
  contextMenu: "capsule:context-menu",
  startMove: "capsule:start-move",
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
  openSettings: "Settings",
  position: "Position",
  quit: "Quit Capsule",
  demoMode: "Demo mode",
  demoModeHint: "Show sample numbers instead of your real usage.",
  launchAtLogin: "Launch at login",
  launchAtLoginHint: "Start Capsule automatically when you log in.",
  pollInterval: "Refresh every",
  pollIntervalHint: "How often Capsule re-reads usage from each provider.",
  placement: "Placement",
  placementHint:
    "Or just drag the dock — it snaps to whichever edge you drop it near.",
  providers: "Providers",
  appearance: "Appearance",
  general: "General",
  preview: "Preview",
  dockSize: "Dock size",
  dockSizeHint: "Scales the whole dock — rings, card and type together.",
  decreaseSize: "Make the dock smaller",
  increaseSize: "Make the dock bigger",
  theme: "Theme",
  themeHint:
    "Auto follows macOS and swaps between Midnight and Porcelain on its own.",
  themeAuto: "Auto",
  themeAutoHint: "Match the system appearance.",
  dockStyle: "Dock style",
  dockStyleHint: "How the dock meets the edge it is parked against.",
  recentre: "Re-centre",
  recentreHint:
    "Forget where the dock was last dragged and centre it on its edge.",
  providersHint:
    "Capsule reads the logins these CLIs already keep on this Mac. Turn one off to hide its ring.",
  statusLabels: {
    ok: "Connected",
    stale: "Last known numbers",
    error: "Could not reach",
    unauthenticated: "Not signed in",
    idle: "Waiting",
  },
  onboardingTitle: "Welcome to Capsule",
  onboardingBody:
    "Capsule reads Claude, Codex, and Grok logins already on this Mac. Sign in with those CLIs, or turn on demo mode to preview the dock.",
  enableDemo: "Enable demo mode",
} as const;
