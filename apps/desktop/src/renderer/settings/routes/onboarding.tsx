import { COPY } from "@capsule/config";
import { Button } from "@capsule/ui";
import { useCapsuleSettings } from "../use-settings.ts";

export function OnboardingPage() {
  const { update } = useCapsuleSettings();
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-2xl border border-shell-line bg-shell-panel p-6">
      <h2 className="text-xl font-semibold">{COPY.onboardingTitle}</h2>
      <p className="text-sm leading-relaxed text-shell-muted">
        {COPY.onboardingBody}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            await update({ demoMode: true });
            window.location.hash = "#/";
          }}
        >
          {COPY.enableDemo}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.hash = "#/providers";
          }}
        >
          {COPY.providers}
        </Button>
      </div>
    </div>
  );
}
