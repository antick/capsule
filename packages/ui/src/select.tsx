import type { ReactElement, SelectHTMLAttributes } from "react";
import { cn } from "./cn.ts";

/**
 * A native select wearing the shell's own chrome. Native because the list it
 * opens is a macOS menu, which no styled div can match for keyboard handling
 * or for the way it lands over the window edge.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return (
    <span className="relative inline-flex items-center">
      <select
        className={cn(
          "h-8 appearance-none rounded-lg border border-shell-line-strong bg-shell-panel py-0 pl-3 pr-8 text-[13px] font-medium text-shell-text shadow-sm transition-colors hover:bg-shell-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2.5 h-3 w-3 text-shell-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 4.75 6 1.75l3 3" />
        <path d="M9 7.25 6 10.25l-3-3" />
      </svg>
    </span>
  );
}
