import { COPY, clampHudScale } from "@capsule/config";
import { Button } from "@capsule/ui";
import { DockPreview } from "../components/dock-preview.tsx";
import { PlacementPicker } from "../components/placement-picker.tsx";
import { Section } from "../components/section.tsx";
import { SizeStepper } from "../components/size-stepper.tsx";
import { StylePicker } from "../components/style-picker.tsx";
import { ThemePicker } from "../components/theme-picker.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

export function AppearancePage() {
  const { settings, snapshots, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <>
      <Section title={COPY.preview}>
        <DockPreview
          preset={settings.placementPreset}
          scale={settings.hudScale}
          themeSetting={settings.hudTheme}
          styleId={settings.dockStyle}
          snapshots={snapshots}
        />
      </Section>

      <Section title={COPY.dockStyle} hint={COPY.dockStyleHint}>
        <StylePicker
          value={settings.dockStyle}
          onChange={(dockStyle) => void update({ dockStyle })}
        />
      </Section>

      <Section title={COPY.theme} hint={COPY.themeHint}>
        <ThemePicker
          value={settings.hudTheme}
          onChange={(hudTheme) => void update({ hudTheme })}
        />
      </Section>

      <Section
        title={COPY.placement}
        hint={COPY.placementHint}
        aside={
          settings.customPosition ? (
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              title={COPY.recentreHint}
              onClick={() => void update({ customPosition: null })}
            >
              {COPY.recentre}
            </Button>
          ) : null
        }
      >
        <PlacementPicker
          value={settings.placementPreset}
          onChange={(preset) =>
            void update({ placementPreset: preset, customPosition: null })
          }
        />
      </Section>

      <Section title={COPY.dockSize} hint={COPY.dockSizeHint}>
        <SizeStepper
          value={settings.hudScale}
          onChange={(scale) => void update({ hudScale: clampHudScale(scale) })}
        />
      </Section>
    </>
  );
}
