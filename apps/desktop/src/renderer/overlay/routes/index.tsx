import {
  type CapsuleSettings,
  DEMO_NOW_ISO,
  type PlacementPreset,
  type UsageSnapshot,
} from "@capsule/config";
import { UsageDock } from "@capsule/hud";
import { useEffect, useMemo, useState } from "react";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);
  const [settings, setSettings] = useState<CapsuleSettings | null>(null);

  useEffect(() => {
    if (!window.capsule) {
      console.error("Capsule preload bridge is missing");
      return;
    }
    return window.capsule.onSnapshots((nextSnapshots, nextSettings) => {
      setSnapshots(nextSnapshots);
      setSettings(nextSettings);
    });
  }, []);

  const layout = useMemo(
    () => layoutForPreset(settings?.placementPreset ?? "right-edge"),
    [settings?.placementPreset],
  );

  if (snapshots.length === 0) {
    return null;
  }

  return (
    <div
      onPointerMove={(event) => {
        const target = event.target as HTMLElement;
        window.capsule.setPointerCapture(
          Boolean(target.closest("[data-usage-dock='true']")),
        );
      }}
      onPointerLeave={() => window.capsule.setPointerCapture(false)}
    >
      <UsageDock
        snapshots={snapshots}
        orientation={layout.orientation}
        cardGrowth={layout.cardGrowth}
        now={settings?.demoMode ? new Date(DEMO_NOW_ISO) : new Date()}
        forceOpenProviderId={null}
        onOpenChange={(open, providerId) => {
          window.capsule.setExpanded(open, providerId);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          window.capsule.showContextMenu();
        }}
      />
    </div>
  );
}

function layoutForPreset(preset: PlacementPreset): {
  orientation: "vertical" | "horizontal";
  cardGrowth: "left" | "right" | "up";
} {
  if (preset === "left-edge" || preset.startsWith("stage-manager")) {
    return { orientation: "vertical", cardGrowth: "right" };
  }
  if (preset.startsWith("dock-flank")) {
    return { orientation: "horizontal", cardGrowth: "up" };
  }
  return { orientation: "vertical", cardGrowth: "left" };
}
