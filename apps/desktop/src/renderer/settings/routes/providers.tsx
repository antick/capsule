import {
  COPY,
  HUD,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  SEVERITY_COLORS,
  severityForPercent,
  type UsageStatus,
} from "@capsule/config";
import { ProviderIcon } from "@capsule/hud";
import { Switch } from "@capsule/ui";
import { Section } from "../components/section.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

const STATUS_TONE: Record<UsageStatus | "idle", string> = {
  ok: "bg-shell-accent",
  stale: "bg-amber-400",
  error: "bg-red-500",
  unauthenticated: "bg-shell-muted",
  idle: "bg-shell-muted",
  disabled: "bg-shell-muted",
};

export function ProvidersPage() {
  const { settings, snapshots, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <Section title={COPY.providers} hint={COPY.providersHint}>
      <div className="flex flex-col gap-2">
        {PROVIDER_IDS.map((id) => {
          const snapshot = snapshots.find((item) => item.providerId === id);
          const status = snapshot?.status ?? "idle";
          const enabled = settings.enabledProviderIds.includes(id);
          const percent = snapshot?.primaryPercent ?? null;
          return (
            <div
              key={id}
              className="flex items-center gap-4 rounded-xl border border-shell-line bg-shell-raised/50 px-4 py-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black">
                <ProviderIcon id={id} color={HUD.text} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{PROVIDER_LABELS[id]}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-shell-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[status]}`}
                  />
                  {COPY.statusLabels[status]}
                </div>
              </div>
              {percent === null ? null : (
                <span
                  className="text-sm tabular-nums"
                  style={{
                    color:
                      SEVERITY_COLORS[severityForPercent(Math.round(percent))],
                  }}
                >
                  {Math.round(percent)}
                  {COPY.percentSuffix}
                </span>
              )}
              <Switch
                checked={enabled}
                aria-label={PROVIDER_LABELS[id]}
                onCheckedChange={(checked) => {
                  // Rebuilt from the canonical list rather than appended to,
                  // so re-enabling a provider puts its ring back where it was.
                  const wanted = new Set(settings.enabledProviderIds);
                  if (checked) {
                    wanted.add(id);
                  } else {
                    wanted.delete(id);
                  }
                  void update({
                    enabledProviderIds: PROVIDER_IDS.filter((item) =>
                      wanted.has(item),
                    ),
                  });
                }}
              />
            </div>
          );
        })}
      </div>
    </Section>
  );
}
