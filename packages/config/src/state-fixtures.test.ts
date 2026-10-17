import { acceptedOrRejected, goldenSuite } from "@capsule/fixtures/vitest";
import {
  type ActivityByProvider,
  type AgentSession,
  anyAgentActive,
  orderSessions,
  summarizeActivity,
} from "./activity.ts";
import { defaultSettings, settingsSchema } from "./settings.ts";
import {
  canCheckForUpdates,
  formatBytes,
  formatProgress,
  initialUpdateState,
  plainReleaseNotes,
  releaseUrlFor,
  type UpdateProgress,
  type UpdateState,
  updateDetail,
  updateShortLabel,
  updateTitle,
  updateTone,
} from "./updates.ts";

/**
 * Settings, update wording and session ordering, recorded from this
 * implementation and read by the Swift port.
 */

goldenSuite("settings/defaults", () => defaultSettings());

goldenSuite("settings/parse-current", (raw: unknown) =>
  acceptedOrRejected(() => settingsSchema.parse(raw)),
);

goldenSuite("settings/migrate-legacy", (raw: unknown) =>
  acceptedOrRejected(() => settingsSchema.parse(raw)),
);

goldenSuite("updates/format-bytes", (bytes: number) => formatBytes(bytes));

goldenSuite("updates/format-progress", (progress: UpdateProgress) =>
  formatProgress(progress),
);

goldenSuite("updates/release-url", (version: string | null) =>
  releaseUrlFor(version),
);

goldenSuite("updates/plain-release-notes", (raw: unknown) =>
  plainReleaseNotes(raw),
);

goldenSuite("updates/wording", (state: UpdateState) => ({
  tone: updateTone(state.phase),
  shortLabel: updateShortLabel(state.phase),
  title: updateTitle(state),
  detail: updateDetail(state),
  canCheck: canCheckForUpdates(state),
}));

goldenSuite(
  "updates/initial-state",
  (input: { version: string; canInstall: boolean }) =>
    initialUpdateState(input.version, input.canInstall),
);

goldenSuite("activity/summarize", (sessions: AgentSession[] | null) =>
  summarizeActivity(sessions ?? undefined),
);

goldenSuite("activity/order-sessions", (sessions: AgentSession[]) =>
  orderSessions(sessions),
);

goldenSuite("activity/any-active", (activity: ActivityByProvider) =>
  anyAgentActive(activity),
);
