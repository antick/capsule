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
    <fieldset className="m-0 inline-flex gap-0.5 rounded-[10px] border border-shell-line bg-shell-raised p-[3px]">
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
              "rounded-[7px] px-2.5 py-1 text-[12.5px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent-line",
              selected
                ? "bg-shell-panel font-medium text-shell-text shadow-sm"
                : "text-shell-muted hover:text-shell-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
