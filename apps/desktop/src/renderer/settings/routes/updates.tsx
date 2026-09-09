import {
  APP_NAME,
  canCheckForUpdates,
  formatProgress,
  UPDATE_COPY,
  type UpdateState,
  updateDetail,
  updateTitle,
  updateTone,
} from "@capsule/config";
import { formatAgo } from "@capsule/dates";
import { Button, ProgressBar, StatusPill, Switch } from "@capsule/ui";
import { ExternalLink } from "lucide-react";
import type { ReactElement } from "react";
import { PageHeader, Row, Section } from "../components/section.tsx";
import { useCapsuleSettings } from "../use-settings.ts";
import { useUpdateState } from "../use-update.ts";

export function UpdatesPage(): ReactElement | null {
  const { settings, update: save } = useCapsuleSettings();
  const state = useUpdateState();

  if (!settings || !state) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={UPDATE_COPY.updates}
        description={UPDATE_COPY.updatesHint}
      />

      <Section>
        <UpdateStatus state={state} />
      </Section>

      {state.releaseNotes ? (
        <Section
          title={UPDATE_COPY.releaseNotes}
          hint={
            state.availableVersion
              ? `${APP_NAME} ${state.availableVersion}`
              : undefined
          }
        >
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-shell-raised p-3.5 font-sans text-[12.5px] leading-relaxed text-shell-muted">
            {state.releaseNotes}
          </pre>
        </Section>
      ) : null}

      <Section>
        <Row
          label={UPDATE_COPY.autoCheck}
          hint={UPDATE_COPY.autoCheckHint}
          control={
            <Switch
              aria-label={UPDATE_COPY.autoCheck}
              checked={settings.autoUpdateCheck}
              disabled={!state.canInstall}
              onCheckedChange={(checked) =>
                void save({ autoUpdateCheck: checked })
              }
            />
          }
        />
        <Row
          label={UPDATE_COPY.autoDownload}
          hint={UPDATE_COPY.autoDownloadHint}
          control={
            <Switch
              aria-label={UPDATE_COPY.autoDownload}
              checked={settings.autoUpdateDownload}
              disabled={!state.canInstall || !settings.autoUpdateCheck}
              onCheckedChange={(checked) =>
                void save({ autoUpdateDownload: checked })
              }
            />
          }
        />
        <Row
          label={UPDATE_COPY.currentVersion}
          control={
            <span className="text-[13px] tabular-nums text-shell-muted">
              {state.currentVersion}
            </span>
          }
        />
      </Section>
    </>
  );
}

/**
 * The whole standing of the update in one block: where it is, how far it has
 * got, and the single thing to press next.
 */
function UpdateStatus({ state }: { state: UpdateState }): ReactElement {
  const detail = updateDetail(state);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">{updateTitle(state)}</h2>
            <StatusPill tone={updateTone(state.phase)}>
              {state.availableVersion ?? state.currentVersion}
            </StatusPill>
          </div>
          {detail ? (
            <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-shell-muted">
              {detail}
            </p>
          ) : null}
          <p className="mt-2 text-[11.5px] text-shell-faint">
            {UPDATE_COPY.lastChecked}:{" "}
            {state.checkedAt
              ? formatAgo(new Date(state.checkedAt))
              : UPDATE_COPY.never}
          </p>
        </div>
        <UpdateActions state={state} />
      </div>

      {state.phase === "downloading" ? (
        <div className="flex flex-col gap-1.5">
          <ProgressBar
            value={state.progress?.fraction ?? 0}
            label={UPDATE_COPY.downloadingTitle}
          />
          <span className="text-[11.5px] tabular-nums text-shell-muted">
            {state.progress
              ? formatProgress(state.progress)
              : UPDATE_COPY.checking}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function UpdateActions({ state }: { state: UpdateState }): ReactElement {
  const bridge = window.capsule;

  if (state.phase === "ready") {
    return (
      <Button className="shrink-0" onClick={() => bridge?.installUpdate()}>
        {UPDATE_COPY.restartAndInstall}
      </Button>
    );
  }

  if (state.phase === "available") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => bridge?.openReleasePage()}
        >
          <ExternalLink size={13} strokeWidth={2} />
          {UPDATE_COPY.viewRelease}
        </Button>
        <Button onClick={() => void bridge?.downloadUpdate()}>
          {UPDATE_COPY.download}
        </Button>
      </div>
    );
  }

  if (!state.canInstall) {
    return (
      <Button className="shrink-0" onClick={() => bridge?.openReleasePage()}>
        <ExternalLink size={13} strokeWidth={2} />
        {UPDATE_COPY.viewRelease}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="shrink-0"
      disabled={!canCheckForUpdates(state)}
      onClick={() => void bridge?.checkForUpdate()}
    >
      {state.phase === "checking" ? UPDATE_COPY.checking : UPDATE_COPY.checkNow}
    </Button>
  );
}
