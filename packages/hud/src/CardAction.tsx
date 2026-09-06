import type { HudMetrics, HudTheme } from "@capsule/config";
import type { ReactNode } from "react";

export function CardAction({
  metrics: m,
  theme,
  label,
  onClick,
  children,
}: {
  metrics: HudMetrics;
  theme: HudTheme;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-hud-hit="true"
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{
        marginLeft: "auto",
        flex: "none",
        border: 0,
        borderRadius: m.cardStatusGap,
        padding: `0 ${m.cardResetGap}px`,
        height: m.cardTitleLine,
        background: theme.barTrack,
        color: theme.text,
        fontSize: m.cardResetSize,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
