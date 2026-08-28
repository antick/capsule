import type { CapsuleSettings, UsageSnapshot } from "@capsule/config";
import { useEffect, useState } from "react";

export function useCapsuleSettings() {
  const [settings, setSettings] = useState<CapsuleSettings | null>(null);
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);

  useEffect(() => {
    void window.capsule.getSettings().then(setSettings);
    return window.capsule.onSnapshots((nextSnapshots, nextSettings) => {
      setSnapshots(nextSnapshots);
      setSettings(nextSettings);
    });
  }, []);

  const update = async (patch: Partial<CapsuleSettings>) => {
    if (!settings) {
      return;
    }
    const next = await window.capsule.setSettings({ ...settings, ...patch });
    setSettings(next);
  };

  return { settings, snapshots, update };
}
