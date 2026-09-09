import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn.ts";

/**
 * The one shape the app uses to say how something is doing — a provider's
 * connection, an update check. Tones rather than colours, so a status never
 * has to name a hex value at the call site.
 */
export const STATUS_TONES = ["good", "warn", "bad", "neutral", "busy"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/** The tone as a text colour, for a number or word that carries it alone. */
export function toneTextClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}

const TONE_CLASS: Record<StatusTone, string> = {
  good: "text-shell-accent",
  warn: "text-shell-warn",
  bad: "text-shell-danger",
  neutral: "text-shell-muted",
  busy: "text-shell-muted",
};

const DOT_CLASS: Record<StatusTone, string> = {
  good: "bg-shell-accent",
  warn: "bg-shell-warn",
  bad: "bg-shell-danger",
  neutral: "bg-shell-faint",
  busy: "bg-shell-muted animate-pulse",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-shell-raised px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
      {children}
    </span>
  );
}
