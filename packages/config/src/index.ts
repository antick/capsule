export type { PlacementPreset, ProviderId, Severity } from "./constants.ts";
export {
  ANTHROPIC_OAUTH_BETA_HEADER,
  ANTHROPIC_OAUTH_USAGE_URL,
  APP_NAME,
  CHATGPT_USAGE_URL,
  CHROME_POLL_MS,
  CLAUDE_CREDENTIALS_PATH_SEGMENTS,
  CODEX_AUTH_PATH_SEGMENTS,
  COPY,
  HUD,
  IPC,
  MOTION,
  PLACEMENT,
  PLACEMENT_PRESETS,
  POLL_INTERVAL_MS,
  PROVIDER_IDS,
  SEVERITY_BANDS,
  SEVERITY_COLORS,
} from "./constants.ts";
export { DEMO_NOW_ISO, DEMO_SNAPSHOTS } from "./demo.ts";
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
