import { ACTIVITY_NOTICE_COPY } from "./activity-notices.ts";

export const APP_NAME = "Capsule";

export const PROVIDER_IDS = [
  "claude",
  "codex",
  "grok",
  "cursor",
  "copilot",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * What a fresh install shows. Cursor and Copilot are read from the editor's
 * and GitHub's own logins, so they stay off until switched on in Settings
 * rather than adding two empty rings to everyone's dock.
 */
export const DEFAULT_ENABLED_PROVIDER_IDS = [
  "claude",
  "codex",
  "grok",
] as const satisfies readonly ProviderId[];

export const PROVIDER_LABELS = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok",
  cursor: "Cursor",
  copilot: "Copilot",
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
   * Most live sessions a card lists before counting the rest. Past this the
   * list has stopped being glanceable, and counting is the kinder answer.
   */
  maxCardSessions: 4,
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
   * The notch the dock draws for itself on a display that has none. As wide
   * as a MacBook's, and as deep as the menu bar it sits in — this is the
   * fallback depth for when there is no menu bar to measure.
   */
  notchWidth: 200,
  notchDepth: 32,
  /**
   * The dot a folded dock carries when an agent is working or waiting, so the
   * glance works while the dock is hidden — which is when it matters most.
   */
  beaconSize: 4,
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
  /**
   * How far the meters slide toward the screen edge as the dock folds away.
   * A short slide, no scaling: the shape's own outline does the concealing,
   * and scaling on top of it reads as two effects fighting.
   */
  stowShift: 10,
  /**
   * The activity indicator: a thinner arc inside the ring, in the gap between
   * the glyph and the track, so it reads as a separate fact rather than as
   * the usage number moving.
   */
  activitySize: 23,
  activityStroke: 2,
  /** Rule above the session list in the card, and the room either side of it. */
  cardRule: 1,
  cardRuleGap: 10,
  /** The tiny ring beside a session's status word. */
  cardStatusDot: 8,
  cardStatusStroke: 1.5,
  cardStatusGap: 5,
  /**
   * The small inverse corner where a bar flush with the display's own notch
   * meets the screen's frame. The hardware notch is moulded into the bezel
   * rather than cut out of it; a raw square edge does not read that way.
   */
  notchBezelFillet: 8,
} as const;

/**
 * How long an auto-hiding dock waits after the pointer leaves before it folds
 * away. A gesture that crosses a corner of the card should not dismiss it,
 * but how much grace that needs is a matter of taste, so it is a setting.
 */
export const HIDE_DELAY_IDS = [
  "instant",
  "quick",
  "normal",
  "relaxed",
] as const;
export type HideDelayId = (typeof HIDE_DELAY_IDS)[number];
export const HIDE_DELAYS = {
  instant: 0,
  quick: 150,
  normal: 460,
  relaxed: 1100,
} as const satisfies Record<HideDelayId, number>;
export const HIDE_DELAY_LABELS = {
  instant: "Instant",
  quick: "Quick",
  normal: "Normal",
  relaxed: "Relaxed",
} as const satisfies Record<HideDelayId, string>;

export const MOTION = {
  openMs: 260,
  closeMs: 170,
  /**
   * Grace after the pointer leaves before the dock retracts, so crossing a
   * corner of the card on the way to something else does not dismiss it.
   */
  peekHoldMs: 460,
  /** How long "Show Dock" keeps the dock out before it may retract again. */
  revealHoldMs: 3200,
  /** Gap between one meter arriving and the next, during the unroll. */
  meterStaggerMs: 45,
  /** The stagger stops growing here, so a long rail never feels sluggish. */
  meterStaggerCapMs: 180,
  /**
   * The card's contents changing while the card itself is still moving. An
   * ease rather than a spring: a crossfade has nothing to overshoot.
   */
  crossfadeMs: 160,
  /** How far a ring presses in while its provider is being re-read. */
  refreshPressScale: 0.93,
  /** One turn of the activity arc while an agent works. */
  activitySpinMs: 1100,
  /** How much of the circle that moving arc covers. */
  activityArc: 0.25,
  /** One breath of the ring that pulses while an agent waits on you. */
  activityPulseMs: 900,
  /** How faint the pulse gets. */
  activityPulseFloor: 0.3,
  /** One turn of the small status ring beside a busy session in the card. */
  statusSpinMs: 1400,
  /** One lap of the arc that chases a ring while its provider reloads. */
  sweepMs: 1100,
  /** How much of the ring that chasing arc covers. */
  sweepArc: 0.18,
  /** Resizing the dock eases through the sizes in between instead of jumping. */
  zoomMs: 280,
  /** Grace before the window shrinks back onto the eased-down artwork. */
  zoomSettleMs: 60,
  barMs: 420,
  meterMs: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  /**
   * Things being absorbed accelerate as they go, so anything folding shut
   * eases in rather than out.
   */
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
export const POLL_INTERVAL_OPTIONS = [
  { value: 30_000, label: "30 seconds" },
  { value: 60_000, label: "1 minute" },
  { value: 300_000, label: "5 minutes" },
  { value: 900_000, label: "15 minutes" },
] as const;
export const CHROME_POLL_MS = 2_000;

/**
 * Pretend the display has a notch of this size, as "200x37", for trying the
 * joined top edge on a Mac that has none. Development only.
 */
export const FAKE_NOTCH_ENV = "CAPSULE_FAKE_NOTCH";

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
  /** Live agent sessions, by provider, from the monitors main runs. */
  activity: "capsule:activity",
  getActivity: "capsule:get-activity",
  /**
   * Holding an auto-hiding dock out. A gesture rather than a setting: it
   * lasts as long as this session of looking at it, and either the dock or a
   * menu can flip it.
   */
  keepOpen: "capsule:keep-open",
  setKeepOpen: "capsule:set-keep-open",
  getKeepOpen: "capsule:get-keep-open",
  /** Tokens spent today and this month, by provider, from local session logs. */
  tokens: "capsule:tokens",
  getTokens: "capsule:get-tokens",
} as const;

export const COPY = {
  ...ACTIVITY_NOTICE_COPY,
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
  percentRemainingSuffix: "% Remaining",
  percentSuffix: "%",
  cursorPlan: "Plan usage",
  copilotPremium: "Premium requests",
  copilotChat: "Chat",
  tokenUsage: "Token usage",
  tokensToday: "Today",
  tokensMonth: "Last 30 days",
  usageDisplay: "Show usage as",
  usageDisplayHint:
    "Whether the rings, bars and percentages count what you have used or what you have left.",
  usageDisplayUsed: "Used",
  usageDisplayRemaining: "Remaining",
  usageTitleSuffix: " Usage",
  usageDisabled: "Live usage disabled. Check usage in the provider’s app.",
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
  appearanceHint:
    "How the dock looks and where it lives. Everything here is previewed above as you change it.",
  general: "General",
  generalHint: "Refreshing, notifications, and how Capsule starts up.",
  behaviour: "Behaviour",
  usageReadings: "Usage readings",
  system: "System",
  behaviourHint: "When the dock shows itself and when it gets out of the way.",
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
    "Drag the dock to a corner and it bends into a quarter arc. With Hide until needed on, it folds down to a thin curve and expands when approached.",
  hideDelay: "Hide after",
  hideDelayHint:
    "How long the dock waits after the pointer leaves before it folds away. Longer is more forgiving when you cross a corner of the card on the way to something else.",
  topEdgeNotch: "Draw as a notch",
  topEdgeNotchHint:
    "Centred at the top like the MacBook notch: straight sides, a rounded underside, and at rest a notch-sized tab in the menu bar. On a MacBook display it merges with the real notch. Turn off for a plain bar you can drag along the edge.",
  autoHide: "Hide until needed",
  autoHideHint:
    "The dock rests as a slim latch in the screen edge and unrolls when you reach for it.",
  showDock: "Show Dock",
  showDockHint:
    "Unrolls the dock and holds it there for a few seconds, for when you have lost track of the latch.",
  providersHint:
    "Capsule reads the logins these tools already keep on this Mac. Turn one off to hide its ring; Cursor and Copilot start off.",
  statusLabels: {
    ok: "Connected",
    stale: "Last known numbers",
    error: "Could not reach",
    unauthenticated: "Not signed in",
    disabled: "Live usage disabled",
    idle: "Waiting",
  },
  onboardingTitle: "Welcome to Capsule",
  onboardingBody:
    "Capsule reads Claude, Codex, and Grok usage from logins already on this Mac. Agent chat remains disabled.",
  enableDemo: "Enable demo mode",
  keepOpen: "Keep open",
  keepOpenDisabledHint:
    'The dock is always shown. Turn on "Hide until needed" to hold it out on demand.',
  sessionBusy: "working",
  sessionWaiting: "waiting",
  sessionIdle: "idle",
  sessionWorkingDetail: "Working",
  moreSessionsPrefix: "and ",
  moreSessionsSuffix: " more",
  surfaceDesktop: "Desktop",
  surfaceVsCode: "VS Code",
  surfaceAgent: "Agent",
  surfaceTerminal: "Terminal",
} as const;
