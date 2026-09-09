import {
  COPY,
  HUD_THEME_IDS,
  HUD_THEMES,
  type HudTheme,
  type HudThemeSetting,
} from "@capsule/config";
import type { ReactElement } from "react";
import { OptionCard } from "./section.tsx";

/** A miniature of the dock's own surface, rings and type in each palette. */
function Swatch({ theme }: { theme: HudTheme }): ReactElement {
  return (
    <span
      className="flex h-10 w-16 shrink-0 items-center justify-center gap-1 rounded-lg"
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
    <span className="flex h-10 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-shell-line-strong">
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
      {options.map((option) => (
        <OptionCard
          key={option.id}
          layout="inline"
          selected={value === option.id}
          label={option.label}
          hint={option.hint}
          onClick={() => onChange(option.id)}
        >
          {option.swatch}
        </OptionCard>
      ))}
    </div>
  );
}
