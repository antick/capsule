import { COPY } from "@capsule/config";
import { Switch } from "@capsule/ui";
import { Row, Section } from "../components/section.tsx";
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
