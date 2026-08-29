import {
  COPY,
  HUD_THEME_IDS,
  HUD_THEMES,
  type HudTheme,
  type HudThemeSetting,
} from "@capsule/config";
import { cn } from "@capsule/ui";
import type { ReactElement } from "react";

/** A miniature of the dock's own surface, rings and type in each palette. */
function Swatch({ theme }: { theme: HudTheme }): ReactElement {
  return (
    <span
      className="flex h-9 w-14 shrink-0 items-center justify-center gap-1 rounded-lg"
      style={{
        background: theme.surface,
        boxShadow: `inset 0 0 0 1px ${theme.surfaceEdge}`,
      }}
    >
      <span
        className="h-3.5 w-3.5 rounded-full"
        style={{ boxShadow: `inset 0 0 0 2px ${theme.ringTrack}` }}
      />
      <span
        className="h-3.5 w-3.5 rounded-full"
        style={{ boxShadow: "inset 0 0 0 2px #00F58A" }}
      />
      <span
        className="h-1.5 w-4 rounded-full"
        style={{ background: theme.text }}
      />
    </span>
  );
}

/** The auto option needs to show both halves of the pair it switches between. */
function AutoSwatch(): ReactElement {
  return (
    <span className="flex h-9 w-14 shrink-0 overflow-hidden rounded-lg">
      <span
        className="h-full w-1/2"
        style={{ background: HUD_THEMES.porcelain.surface }}
      />
      <span
        className="h-full w-1/2"
        style={{ background: HUD_THEMES.midnight.surface }}
      />
    </span>
  );
}

export function ThemePicker({
  value,
  onChange,
}: {
  value: HudThemeSetting;
  onChange: (theme: HudThemeSetting) => void;
}): ReactElement {
  const options: Array<{
    id: HudThemeSetting;
    label: string;
    hint: string;
    swatch: ReactElement;
  }> = [
    {
      id: "auto",
      label: COPY.themeAuto,
      hint: COPY.themeAutoHint,
      swatch: <AutoSwatch />,
    },
    ...HUD_THEME_IDS.map((id) => ({
      id: id as HudThemeSetting,
      label: HUD_THEMES[id].label,
      hint: HUD_THEMES[id].hint,
      swatch: <Swatch theme={HUD_THEMES[id]} />,
    })),
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-shell-accent/60 bg-shell-accent/10"
                : "border-shell-line bg-shell-panel hover:bg-shell-raised",
            )}
          >
            {option.swatch}
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-shell-muted">
                {option.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
