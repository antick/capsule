import {
  COPY,
  CORNER_ARC_ENABLED,
  clampHudScale,
  HIDE_DELAY_IDS,
  HIDE_DELAY_LABELS,
} from "@capsule/config";
import { Button, Switch } from "@capsule/ui";
import { DockPreview } from "../components/dock-preview.tsx";
import { PlacementPicker } from "../components/placement-picker.tsx";
import { Row, Section } from "../components/section.tsx";
import { Segmented } from "../components/segmented.tsx";

const HIDE_DELAY_OPTIONS = HIDE_DELAY_IDS.map((id) => ({
  value: id,
  label: HIDE_DELAY_LABELS[id],
}));

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
              onClick={() =>
                void update({ customPosition: null, customCorner: null })
              }
            >
              {COPY.recentre}
            </Button>
          ) : null
        }
      >
        <PlacementPicker
          value={settings.placementPreset}
          onChange={(preset) =>
            void update({
              placementPreset: preset,
              customPosition: null,
              customCorner: null,
            })
          }
        />
        <Row
          label={COPY.autoHide}
          hint={COPY.autoHideHint}
          control={
            <Switch
              aria-label={COPY.autoHide}
              checked={settings.autoHide}
              onCheckedChange={(checked) => void update({ autoHide: checked })}
            />
          }
        />
        {settings.autoHide ? (
          <Row
            label={COPY.hideDelay}
            hint={COPY.hideDelayHint}
            control={
              <Segmented
                label={COPY.hideDelay}
                value={settings.hideDelay}
                options={HIDE_DELAY_OPTIONS}
                onChange={(value) => void update({ hideDelay: value })}
              />
            }
          />
        ) : null}
        {settings.autoHide ? (
          <Row
            label={COPY.showDock}
            hint={COPY.showDockHint}
            control={
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => window.capsule?.revealDock()}
              >
                {COPY.showDock}
              </Button>
            }
          />
        ) : null}
        {settings.placementPreset === "top-edge" ? (
          <Row
            label={COPY.topEdgeNotch}
            hint={COPY.topEdgeNotchHint}
            control={
              <Switch
                aria-label={COPY.topEdgeNotch}
                checked={settings.topEdgeNotch}
                onCheckedChange={(checked) =>
                  void update({ topEdgeNotch: checked })
                }
              />
            }
          />
        ) : null}
        {CORNER_ARC_ENABLED ? (
          <Row
            label={COPY.cornerArc}
            hint={COPY.cornerArcHint}
            control={
              <Switch
                aria-label={COPY.cornerArc}
                checked={settings.cornerArc}
                onCheckedChange={(checked) =>
                  void update({ cornerArc: checked })
                }
              />
            }
          />
        ) : null}
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
