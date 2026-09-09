import type { ReactElement } from "react";
import { cn } from "./cn.ts";

/** A determinate bar for anything that reports a fraction of itself done. */
export function ProgressBar({
  value,
  label,
  className,
}: {
  /** 0 to 1. Anything outside that is clamped rather than overflowing. */
  value: number;
  label: string;
  className?: string;
}): ReactElement {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={filled}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-shell-line",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-shell-accent transition-[width] duration-300"
        style={{ width: `${filled}%` }}
      />
    </div>
  );
}
