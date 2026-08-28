import { COPY, PLACEMENT_PRESETS } from "@capsule/config";
import { useCapsuleSettings } from "../use-settings.ts";

export function PlacementPage() {
  const { settings, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">{COPY.placement}</legend>
      {PLACEMENT_PRESETS.map((preset) => (
        <label key={preset} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="placement"
            checked={settings.placementPreset === preset}
            onChange={() => void update({ placementPreset: preset })}
          />
          {preset}
        </label>
      ))}
    </fieldset>
  );
}
