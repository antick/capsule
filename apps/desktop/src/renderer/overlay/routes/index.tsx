import {
  type CapsuleSettings,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  defaultSettings,
  layoutForPreset,
  type UsageSnapshot,
} from "@capsule/config";
import { UsageDock } from "@capsule/hud";
import { useEffect, useMemo, useState } from "react";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>(DEMO_SNAPSHOTS);
  const [settings, setSettings] = useState<CapsuleSettings>(defaultSettings);

  useEffect(() => {
    if (!window.capsule) {
      return;
    }
    return window.capsule.onSnapshots((nextSnapshots, nextSettings) => {
      if (nextSnapshots.length > 0) {
        setSnapshots(nextSnapshots);
      }
      setSettings(nextSettings);
    });
  }, []);

  const layout = useMemo(
    () => layoutForPreset(settings.placementPreset),
    [settings.placementPreset],
  );

  return (
    <div
      onPointerMove={(event) => {
        const target = event.target as HTMLElement;
        window.capsule?.setPointerCapture(
          Boolean(
            target.closest("[data-hud-rail='true'], [data-card-open='true']"),
          ),
        );
      }}
      onPointerLeave={() => window.capsule?.setPointerCapture(false)}
    >
      <UsageDock
        snapshots={snapshots}
        orientation={layout.orientation}
        cardGrowth={layout.cardGrowth}
        now={settings.demoMode ? new Date(DEMO_NOW_ISO) : new Date()}
        onOpenChange={(open, providerId) => {
          window.capsule?.setExpanded(open, providerId);
        }}
        onMoveStart={(screenX, screenY) => {
          window.capsule?.startMove(screenX, screenY);
        }}
        onMove={(screenX, screenY) => {
          window.capsule?.moveWindow(screenX, screenY);
        }}
        onMoveEnd={() => {
          window.capsule?.endMove();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          window.capsule?.showContextMenu();
        }}
      />
    </div>
  );
}
