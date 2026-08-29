import { COPY, POLL_INTERVAL_MS } from "@capsule/config";
import { Switch } from "@capsule/ui";
import { Row, Section } from "../components/section.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

const INTERVALS = [30_000, 60_000, 300_000, 900_000] as const;

function intervalLabel(ms: number): string {
  if (ms < 60_000) {
    return `${ms / 1000} seconds`;
  }
  const minutes = ms / 60_000;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function GeneralPage() {
  const { settings, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <Section title={COPY.general}>
      <Row
        label={COPY.launchAtLogin}
        hint={COPY.launchAtLoginHint}
        control={
          <Switch
            aria-label={COPY.launchAtLogin}
            checked={settings.launchAtLogin}
            onCheckedChange={(checked) =>
              void update({ launchAtLogin: checked })
            }
          />
        }
      />
      <Row
        label={COPY.pollInterval}
        hint={COPY.pollIntervalHint}
        control={
          <select
            aria-label={COPY.pollInterval}
            className="h-8 rounded-lg border border-shell-line bg-shell-raised px-2 text-sm"
            value={
              INTERVALS.includes(
                settings.pollIntervalMs as (typeof INTERVALS)[number],
              )
                ? settings.pollIntervalMs
                : POLL_INTERVAL_MS
            }
            onChange={(event) =>
              void update({ pollIntervalMs: Number(event.target.value) })
            }
          >
            {INTERVALS.map((ms) => (
              <option key={ms} value={ms}>
                {intervalLabel(ms)}
              </option>
            ))}
          </select>
        }
      />
      <Row
        label={COPY.demoMode}
        hint={COPY.demoModeHint}
        control={
          <Switch
            aria-label={COPY.demoMode}
            checked={settings.demoMode}
            onCheckedChange={(checked) => void update({ demoMode: checked })}
          />
        }
      />
    </Section>
  );
}
