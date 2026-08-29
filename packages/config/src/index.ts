export type { PlacementPreset, ProviderId, Severity } from "./constants.ts";
export {
  ANTHROPIC_OAUTH_BETA_HEADER,
  ANTHROPIC_OAUTH_USAGE_URL,
  APP_NAME,
  CHROME_POLL_MS,
  CLAUDE_CREDENTIALS_PATH_SEGMENTS,
  CLAUDE_KEYCHAIN_SERVICE,
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
  HUD,
  IPC,
  joinOffsetForIndex,
  MOTION,
  meterBlockSize,
  PLACEMENT,
  PLACEMENT_LABELS,
  PLACEMENT_MENU_GROUPS,
  PLACEMENT_PRESETS,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  railLengthForCount,
  SEVERITY_BANDS,
  SEVERITY_COLORS,
} from "./constants.ts";
export {
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  placeholderSnapshots,
} from "./demo.ts";
export type {
  ChromeSnapshot,
  DockOrientation,
  HudSize,
  PlacementResult,
  Rect,
} from "./placement.ts";
export { computePlacement, layoutForPreset } from "./placement.ts";
export type { CapsuleSettings } from "./settings.ts";
export {
  defaultSettings,
  migrateSettings,
  settingsSchema,
} from "./settings.ts";
export { severityForPercent } from "./severity.ts";
export type { ScreenEdge } from "./snap.ts";
export {
  nearestEdge,
  presetForEdge,
  slideAlongEdge,
  snapAfterDrag,
} from "./snap.ts";
export type {
  UsageBucket,
  UsageSnapshot,
  UsageStatus,
} from "./usage-types.ts";
