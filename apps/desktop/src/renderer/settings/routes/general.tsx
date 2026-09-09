import {
  COPY,
  POLL_INTERVAL_MS,
  POLL_INTERVAL_OPTIONS,
  type UsageDisplay,
} from "@capsule/config";
import { Select, Switch } from "@capsule/ui";
import type { ReactElement } from "react";
import { PageHeader, Row, Section } from "../components/section.tsx";
import { Segmented } from "../components/segmented.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

const USAGE_DISPLAY_OPTIONS: readonly { value: UsageDisplay; label: string }[] =
  [
    { value: "used", label: COPY.usageDisplayUsed },
    { value: "remaining", label: COPY.usageDisplayRemaining },
  ];

export function GeneralPage(): ReactElement | null {
  const { settings, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <>
      <PageHeader title={COPY.general} description={COPY.generalHint} />

      <Section title={COPY.usageReadings}>
        <Row
          label={COPY.pollInterval}
          hint={COPY.pollIntervalHint}
          control={
            <Select
              aria-label={COPY.pollInterval}
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
            </Select>
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
          label={COPY.notificationPopups}
          hint={COPY.notificationPopupsHint}
          control={
            <Switch
              aria-label={COPY.notificationPopups}
              checked={settings.notificationPopups}
              onCheckedChange={(checked) =>
                void update({ notificationPopups: checked })
              }
            />
          }
        />
      </Section>

      <Section title={COPY.system}>
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
    </>
  );
}
