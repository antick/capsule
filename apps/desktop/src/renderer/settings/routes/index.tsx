import { COPY, POLL_INTERVAL_MS } from "@capsule/config";
import { Label, Switch } from "@capsule/ui";
import { useCapsuleSettings } from "../use-settings.ts";

export function OverviewPage() {
  const { settings, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="demo-mode">{COPY.demoMode}</Label>
        <Switch
          id="demo-mode"
          checked={settings.demoMode}
          onCheckedChange={(checked) => void update({ demoMode: checked })}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="launch-at-login">{COPY.launchAtLogin}</Label>
        <Switch
          id="launch-at-login"
          checked={settings.launchAtLogin}
          onCheckedChange={(checked) => void update({ launchAtLogin: checked })}
        />
      </div>
      <label className="flex flex-col gap-2">
        <Label htmlFor="poll-interval">{COPY.pollInterval}</Label>
        <input
          type="number"
          min={5000}
          step={1000}
          id="poll-interval"
          className="h-9 rounded-md border border-neutral-200 px-3"
          value={settings.pollIntervalMs}
          onChange={(event) => {
            const value = Number(event.target.value) || POLL_INTERVAL_MS;
            void update({ pollIntervalMs: value });
          }}
        />
      </label>
    </div>
  );
}
