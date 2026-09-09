import type { ReactElement } from "react";

/**
 * Capsule in miniature: the rail resting against an edge with one meter lit.
 * The same idea as the dock itself, small enough to sit beside the app's name.
 */
export function AppMark({ size = 26 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden="true"
      className="shrink-0"
    >
      <title>Capsule</title>
      <rect
        x="0.5"
        y="0.5"
        width="27"
        height="27"
        rx="8"
        className="fill-shell-text"
      />
      <rect
        x="8"
        y="4.5"
        width="12"
        height="19"
        rx="6"
        className="fill-shell-panel"
      />
      <circle
        cx="14"
        cy="10.5"
        r="3.1"
        fill="none"
        strokeWidth="1.8"
        className="stroke-shell-line-strong"
      />
      <path
        d="M14 7.4a3.1 3.1 0 0 1 2.9 4.2"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="stroke-shell-accent"
      />
      <circle cx="14" cy="17.6" r="3.1" className="fill-shell-line" />
    </svg>
  );
}
