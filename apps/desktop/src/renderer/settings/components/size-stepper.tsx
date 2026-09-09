import { COPY, clampHudScale, HUD_SCALE, nextHudScale } from "@capsule/config";
import { cn } from "@capsule/ui";
import type {
  ReactElement,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef } from "react";

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
  const track = useRef<HTMLDivElement>(null);

  // Dragging reads the pointer's position along the track and snaps it to the
  // nearest size, so the slider can only ever stop where a click would.
  const scrub = useCallback(
    (clientX: number) => {
      const box = track.current?.getBoundingClientRect();
      if (!box || box.width === 0) {
        return;
      }
      const ratio = (clientX - box.left) / box.width;
      onChange(clampHudScale(HUD_SCALE.min + ratio * TRACK_SPAN));
    },
    [onChange],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub(event.clientX);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    scrub(event.clientX);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(nextHudScale(value, -1));
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(nextHudScale(value, 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange(HUD_SCALE.min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(HUD_SCALE.max);
    }
  };

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

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={COPY.dockSize}
        aria-valuemin={Math.round(HUD_SCALE.min * 100)}
        aria-valuemax={Math.round(HUD_SCALE.max * 100)}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="group relative flex h-6 flex-1 cursor-grab touch-none items-center outline-none active:cursor-grabbing"
      >
        <div className="h-1.5 w-full rounded-full bg-shell-line">
          <div
            className="h-full rounded-full bg-shell-accent"
            style={{ width: `${filled}%` }}
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-shell-line-strong bg-shell-panel shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-shell-accent-line"
          style={{ left: `${filled}%` }}
        />
      </div>

      <span className="w-12 text-right text-[13px] font-medium tabular-nums text-shell-muted">
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
        disabled
          ? "cursor-not-allowed border-shell-line text-shell-faint/50"
          : "border-shell-line-strong bg-shell-panel text-shell-text shadow-sm hover:border-shell-accent hover:text-shell-accent active:scale-95",
      )}
    >
      {children}
    </button>
  );
}
