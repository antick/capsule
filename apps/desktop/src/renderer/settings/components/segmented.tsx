import { cn } from "@capsule/ui";
import type { ReactElement } from "react";

/** A row of mutually exclusive choices, for settings with two or three answers. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}): ReactElement {
  return (
    <fieldset className="m-0 inline-flex rounded-lg border border-shell-line bg-shell-raised p-0.5">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm transition-colors",
              selected
                ? "border-shell-accent/60 bg-shell-accent/10 text-shell-text"
                : "border-transparent text-shell-muted hover:text-shell-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
