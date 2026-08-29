export type { PlacementPreset, ProviderId, Severity } from "./constants.ts";
export {
  ANTHROPIC_OAUTH_BETA_HEADER,
  ANTHROPIC_OAUTH_USAGE_URL,
  APP_NAME,
  CHROME_POLL_MS,
  CLAUDE_CREDENTIALS_PATH_SEGMENTS,
  CLAUDE_KEYCHAIN_SERVICE,
  CLAUDE_USAGE_CACHE_FILE,
  CODEX_AUTH_PATH_SEGMENTS,
  CODEX_HOME_ENV,
  CODEX_OAUTH_CLIENT_ID,
  CODEX_TOKEN_URL,
  CODEX_USAGE_FALLBACK_URL,
  CODEX_USAGE_URL,
  COPY,
  GROK_AUTH_PATH_SEGMENTS,
  GROK_BILLING_URL,
  GROK_HOME_ENV,
  GROK_TOKEN_AUTH_VALUE,
  GROK_USER_ID_HEADER,
  HUD,
  HUD_BASE,
  IPC,
  MOTION,
  PLACEMENT,
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  PLACEMENT_PRESETS,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  SEVERITY_BANDS,
  SEVERITY_COLORS,
  USAGE_USER_AGENT,
} from "./constants.ts";
export type { Corner, CornerGeometry, CornerGrowth } from "./corner.ts";
export {
  CORNERS,
  cornerAngle,
  cornerCapFor,
  cornerCardGrowth,
  cornerCardRect,
  cornerForRail,
  cornerGeometry,
  cornerIsBottom,
  cornerIsRight,
  cornerMeterCentre,
  cornerWindowSize,
  railStartForCorner,
} from "./corner.ts";
export {
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  placeholderSnapshots,
} from "./demo.ts";
export type { DockStyle, DockStyleId } from "./dock-style.ts";
export {
  DOCK_STYLE_IDS,
  DOCK_STYLES,
  dockEdgeGap,
  dockStyleFor,
  styleSupportsNotch,
} from "./dock-style.ts";
export type { HudMetrics } from "./metrics.ts";
export {
  cardHeightForBuckets,
  cardMessageHeight,
  clampHudScale,
  HUD_SCALE,
  hudMetrics,
  hudScaleRange,
  hudScaleSteps,
  joinOffsetForIndex,
  meterBlockSize,
  meterStrideSize,
  nextHudScale,
  railLengthForCount,
} from "./metrics.ts";
export type {
  ChromeSnapshot,
  DockOrientation,
  HudSize,
  PlacementResult,
  Rect,
  ScreenEdge,
  SlideTrack,
  WindowBox,
} from "./placement.ts";
export {
  computePlacement,
  dockAlongEdge,
  edgeForPreset,
  layoutForPreset,
  presetForEdge,
  zoomHoldBounds,
} from "./placement.ts";
export type { CapsuleSettings } from "./settings.ts";
export {
  defaultSettings,
  migrateSettings,
  settingsSchema,
} from "./settings.ts";
export { severityForPercent } from "./severity.ts";
export { edgeAffinity, nearestEdgeForPoint, slideAlongEdge } from "./snap.ts";
export type {
  HudAppearance,
  HudTheme,
  HudThemeId,
  HudThemeSetting,
} from "./theme.ts";
export {
  HUD_THEME_AUTO_PAIR,
  HUD_THEME_IDS,
  HUD_THEMES,
  resolveHudTheme,
} from "./theme.ts";
export type {
  UsageBucket,
  UsageSnapshot,
  UsageStatus,
} from "./usage-types.ts";
