import { COPY, HUD_SCALE, nextHudScale } from "@capsule/config";
import { cn } from "@capsule/ui";
import type { ReactElement } from "react";

const TRACK_SPAN = HUD_SCALE.max - HUD_SCALE.min;

export function SizeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (scale: number) => void;
}): ReactElement {
  const atMin = value <= HUD_SCALE.min;
  const atMax = value >= HUD_SCALE.max;
  const filled = ((value - HUD_SCALE.min) / TRACK_SPAN) * 100;

  return (
    <div className="flex items-center gap-4">
      <StepButton
        label={COPY.decreaseSize}
        disabled={atMin}
        onClick={() => onChange(nextHudScale(value, -1))}
      >
        −
      </StepButton>

      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-shell-line">
          <div
            className="h-full rounded-full bg-shell-accent transition-[width] duration-200"
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>

      <span className="w-12 text-right text-sm tabular-nums text-shell-muted">
        {Math.round(value * 100)}%
      </span>

      <StepButton
        label={COPY.increaseSize}
        disabled={atMax}
        onClick={() => onChange(nextHudScale(value, 1))}
      >
        +
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-lg leading-none transition-colors",
        disabled
          ? "cursor-not-allowed border-shell-line/60 text-shell-muted/40"
          : "border-shell-line bg-shell-raised text-shell-text hover:border-shell-accent/60 hover:text-shell-accent active:scale-95",
      )}
    >
      {children}
    </button>
  );
}
