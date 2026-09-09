import { COPY } from "@capsule/config";
import { Button } from "@capsule/ui";
import type { ReactElement } from "react";
import { AppMark } from "../components/app-mark.tsx";
import { Section } from "../components/section.tsx";
import { useCapsuleSettings } from "../use-settings.ts";

export function OnboardingPage(): ReactElement {
  const { update } = useCapsuleSettings();
  return (
    <Section>
      <div className="flex flex-col items-start gap-4">
        <AppMark size={44} />
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
            {COPY.onboardingTitle}
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-shell-muted">
            {COPY.onboardingBody}
          </p>
        </div>
        <div className="flex gap-2 pt-1">
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
    </Section>
  );
}
