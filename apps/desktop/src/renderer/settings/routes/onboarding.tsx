import { COPY } from "@capsule/config";
import { Button } from "@capsule/ui";
import { useCapsuleSettings } from "../use-settings.ts";

export function OnboardingPage() {
  const { update } = useCapsuleSettings();
  return (
    <div className="flex max-w-md flex-col gap-4">
      <h2 className="text-xl font-semibold">{COPY.onboardingTitle}</h2>
      <p className="text-sm text-neutral-600">{COPY.onboardingBody}</p>
      <Button
        onClick={async () => {
          await update({ demoMode: true });
          window.location.hash = "#/";
        }}
      >
        {COPY.enableDemo}
      </Button>
    </div>
  );
}
