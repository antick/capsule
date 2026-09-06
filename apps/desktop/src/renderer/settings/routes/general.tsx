import {
  COPY,
  POLL_INTERVAL_MS,
  POLL_INTERVAL_OPTIONS,
  type UsageDisplay,
} from "@capsule/config";
import { Switch } from "@capsule/ui";
import { Row, Section } from "../components/section.tsx";
import { Segmented } from "../components/segmented.tsx";

const USAGE_DISPLAY_OPTIONS: readonly { value: UsageDisplay; label: string }[] =
  [
    { value: "used", label: COPY.usageDisplayUsed },
    { value: "remaining", label: COPY.usageDisplayRemaining },
  ];

import { useCapsuleSettings } from "../use-settings.ts";

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
              POLL_INTERVAL_OPTIONS.some(
                (option) => option.value === settings.pollIntervalMs,
              )
                ? settings.pollIntervalMs
                : POLL_INTERVAL_MS
            }
            onChange={(event) =>
              void update({ pollIntervalMs: Number(event.target.value) })
            }
          >
            {POLL_INTERVAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      />
      <Row
        label={COPY.usageDisplay}
        hint={COPY.usageDisplayHint}
        control={
          <Segmented
            label={COPY.usageDisplay}
            value={settings.usageDisplay}
            options={USAGE_DISPLAY_OPTIONS}
            onChange={(value) => void update({ usageDisplay: value })}
          />
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
