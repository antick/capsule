import { COPY, PROVIDER_IDS } from "@capsule/config";
import { Switch } from "@capsule/ui";
import { useCapsuleSettings } from "../use-settings.ts";

export function ProvidersPage() {
  const { settings, snapshots, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">{COPY.providers}</h2>
      {PROVIDER_IDS.map((id) => {
        const snapshot = snapshots.find((item) => item.providerId === id);
        const enabled = settings.enabledProviderIds.includes(id);
        return (
          <div key={id} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium capitalize">{id}</div>
              <div className="text-xs text-neutral-500">
                {snapshot?.status ?? "idle"}
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => {
                const enabledProviderIds = checked
                  ? [...new Set([...settings.enabledProviderIds, id])]
                  : settings.enabledProviderIds.filter((item) => item !== id);
                void update({ enabledProviderIds });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
