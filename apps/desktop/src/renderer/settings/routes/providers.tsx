import {
  COPY,
  HUD,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  severityTone,
  type UsageStatus,
} from "@capsule/config";
import { ProviderIcon } from "@capsule/hud";
import {
  cn,
  StatusPill,
  type StatusTone,
  Switch,
  toneTextClass,
} from "@capsule/ui";
import type { ReactElement } from "react";
import { PageHeader, Section } from "../components/section.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

const STATUS_TONE: Record<UsageStatus | "idle", StatusTone> = {
  ok: "good",
  stale: "warn",
  error: "bad",
  unauthenticated: "neutral",
  idle: "busy",
  disabled: "neutral",
};

export function ProvidersPage(): ReactElement | null {
  const { settings, snapshots, update } = useCapsuleSettings();
  if (!settings) {
    return null;
  }
  return (
    <>
      <PageHeader title={COPY.providers} description={COPY.providersHint} />

      <Section>
        <div className="flex flex-col gap-2">
          {PROVIDER_IDS.map((id) => {
            const snapshot = snapshots.find((item) => item.providerId === id);
            const status = snapshot?.status ?? "idle";
            const enabled = settings.enabledProviderIds.includes(id);
            const percent = snapshot?.primaryPercent ?? null;
            return (
              <div
                key={id}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl border border-shell-line bg-shell-raised px-3.5 py-3 transition-opacity",
                  !enabled && "opacity-60",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black">
                  <ProviderIcon id={id} color={HUD.text} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {PROVIDER_LABELS[id]}
                  </div>
                  <StatusPill
                    tone={STATUS_TONE[status]}
                    className="mt-1 bg-transparent px-0"
                  >
                    {COPY.statusLabels[status]}
                  </StatusPill>
                </div>
                {percent === null ? null : (
                  <span
                    className={cn(
                      "text-[13px] font-medium tabular-nums",
                      toneTextClass(severityTone(Math.round(percent))),
                    )}
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
    </>
  );
}
