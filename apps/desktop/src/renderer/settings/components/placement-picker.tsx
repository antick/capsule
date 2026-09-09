import {
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  type PlacementPreset,
} from "@capsule/config";
import { cn } from "@capsule/ui";
import type { ReactElement } from "react";
import { OptionCard } from "./section.tsx";

/**
 * A miniature screen the dock can be pinned to. Choosing an edge here does
 * exactly what dragging the dock to that edge does, so the two stay legible
 * as one behaviour rather than two competing controls.
 */
const EDGE_STYLES: Record<PlacementPreset, string> = {
  "top-edge": "left-1/2 top-[7px] h-[10px] w-16 -translate-x-1/2",
  "bottom-edge": "left-[22%] bottom-[7px] h-[10px] w-16 -translate-x-1/2",
  "left-edge": "left-[7px] top-1/2 h-16 w-[10px] -translate-y-1/2",
  "right-edge": "right-[7px] top-1/2 h-16 w-[10px] -translate-y-1/2",
};

const EDGE_ORDER: PlacementPreset[] = [
  "top-edge",
  "right-edge",
  "bottom-edge",
  "left-edge",
];

export function PlacementPicker({
  value,
  onChange,
}: {
  value: PlacementPreset;
  onChange: (preset: PlacementPreset) => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-16/10 w-full max-w-sm rounded-2xl border border-shell-line bg-shell-raised p-1.5">
        <div
          className="relative h-full w-full overflow-hidden rounded-xl"
          style={{ background: "var(--shell-screen)" }}
        >
          <div className="absolute inset-x-0 top-0 h-[9px] bg-black/35" />
          {/* Stand-in for the macOS Dock, so "beside the Dock" reads visually. */}
          <div className="absolute bottom-[5px] left-1/2 h-3 w-28 -translate-x-1/2 rounded-md bg-white/20" />

          {EDGE_ORDER.map((preset) => {
            const selected = value === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-label={PLACEMENT_LABELS[preset]}
                aria-pressed={selected}
                title={PLACEMENT_LABELS[preset]}
                onClick={() => onChange(preset)}
                className={cn(
                  "absolute rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                  EDGE_STYLES[preset],
                  selected
                    ? "bg-shell-accent shadow-[0_0_14px_var(--shell-accent-line)]"
                    : "bg-white/30 hover:bg-white/55",
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {EDGE_ORDER.map((preset) => (
          <OptionCard
            key={preset}
            layout="inline"
            selected={value === preset}
            label={PLACEMENT_LABELS[preset]}
            hint={PLACEMENT_HINTS[preset]}
            onClick={() => onChange(preset)}
          />
        ))}
      </div>
    </div>
  );
}
