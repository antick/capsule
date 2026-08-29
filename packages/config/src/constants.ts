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
  /**
   * Most rows any provider's card can show. The window is sized for this so a
   * taller-than-usual card is never clipped by the frame it opens inside.
   */
  maxCardBuckets: 3,
  /**
   * Smallest corner arc, as a multiple of the rail's thickness. Without a floor
   * a one- or two-meter arc curls up so tightly it reads as a blob rather than
   * a band tracing the corner.
   */
  cornerMinRadiusRatio: 1.6,
} as const;

/**
 * Every dimension of the dock at scale 1, which is the size it ships at. Read
 * these through `hudMetrics(scale)` rather than directly, so the user's size
 * preference reaches all of them.
 */
export const HUD_BASE = {
  railWidth: 58,
  railPaddingX: 8,
  railPaddingY: 12,
  railRadius: 29,
  // Concave fillet that blends the rail into the screen edge it sits against.
  edgeFlare: 26,
  meterSize: 38,
  ringStroke: 4,
  iconSize: 16,
  meterLabelGap: 4,
  percentBlock: 12,
  percentFontSize: 11,
  itemGap: 12,
  cardWidth: 232,
  cardRadius: 16,
  cardPaddingX: 14,
  cardPaddingTop: 12,
  cardPaddingBottom: 13,
  cardTitleSize: 14,
  cardTitleLine: 18,
  cardTitleGap: 11,
  cardIconSize: 18,
  cardIconGap: 8,
  cardLabelSize: 11,
  cardResetSize: 11,
  cardResetGap: 10,
  cardTextLine: 15,
  cardBucketGap: 5,
  cardSectionGap: 10,
  barHeight: 6,
  // Speech-bubble tail: a pointed spur that stops short of the rail.
  tailBase: 30,
  tailLength: 16,
  joinGap: 6,
  shadowPadding: 18,
  notchRadius: 16,
  notchPaddingY: 8,
  /**
   * The latch: all that is left of the dock once it retracts into the screen
   * edge. A thin tab, long enough to read as a deliberate handle rather than a
   * rendering artefact, and rounded on the side that faces the desktop.
   */
  latchThickness: 5,
  latchLength: 64,
  /**
   * How far in from the edge the latch listens. The tab itself is too thin to
   * aim at, so it answers to a band around it that the user never sees.
   */
  latchReach: 18,
} as const;

export const MOTION = {
  openMs: 260,
  closeMs: 170,
  slideMs: 320,
  /** The dock unrolling out of its latch, and retracting back into it. */
  peekMs: 300,
  peekOutMs: 220,
  /**
   * Grace after the pointer leaves before the dock retracts, so crossing a
   * corner of the card on the way to something else does not dismiss it.
   */
  peekHoldMs: 460,
  /** How long "Show Dock" keeps the dock out before it may retract again. */
  revealHoldMs: 3200,
  /** Gap between one meter arriving and the next, during the unroll. */
  meterStaggerMs: 45,
  /** How small a meter is while it waits out of view. */
  stowedMeterScale: 0.55,
  /** One lap of the arc that chases a ring while its provider reloads. */
  sweepMs: 1100,
  /** How much of the ring that chasing arc covers. */
  sweepArc: 0.18,
  /** Resizing the dock eases through the sizes in between instead of jumping. */
  zoomMs: 280,
  /** Grace before the window shrinks back onto the eased-down artwork. */
  zoomSettleMs: 60,
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
  /**
   * The dock is lit like a card resting on the desktop: a tight contact shadow
   * that reads as the edge meeting the surface, and a wider ambient one at low
   * alpha. A single heavy cast instead spreads a grey cloud across whatever is
   * behind it, which is glaring over a pale window.
   */
  shadowContactDy: 1,
  shadowContactBlur: 3,
  shadowDy: 6,
  shadowBlur: 14,
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
  /**
   * How close to the end of its travel the rail has to be before the dock
   * curls into the corner, when the corner arc is switched on.
   */
  cornerSnapPx: 28,
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
  /** Main tells an open settings window which page to show. */
  navigate: "capsule:navigate",
  /**
   * Main tells the overlay how to draw itself in the window it was just given:
   * where the rail sits inside that window, and whether it has curled into a
   * corner. Both change together during a drag, so they travel together.
   */
  dockFrame: "capsule:dock-frame",
  /** The same, pulled by a renderer that has just (re)loaded. */
  getDockFrame: "capsule:get-dock-frame",
  /**
   * Whether the cursor is over the dock, from the hit test main runs itself.
   * The renderer cannot rely on pointerout for this: the window turns
   * click-through the moment the cursor leaves, and a click-through window
   * raises no such event.
   */
  pointerInside: "capsule:pointer-inside",
  contextMenu: "capsule:context-menu",
  startMove: "capsule:start-move",
  endMove: "capsule:end-move",
  /** Re-poll one provider now, because the user asked for it. */
  refreshProvider: "capsule:refresh-provider",
  /**
   * Unroll the dock and hold it out, so someone who cannot find the latch —
   * a few pixels of dark tab on what may be a dark wallpaper — can see where
   * it lives.
   */
  revealDock: "capsule:reveal-dock",
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
  cornerArc: "Curl into corners",
  cornerArcHint:
    "Drag the dock all the way to a corner and it bends into a quarter arc that traces it.",
  autoHide: "Hide until needed",
  autoHideHint:
    "The dock rests as a slim latch in the screen edge and unrolls when you reach for it.",
  showDock: "Show Dock",
  showDockHint:
    "Unrolls the dock and holds it there for a few seconds, for when you have lost track of the latch.",
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
