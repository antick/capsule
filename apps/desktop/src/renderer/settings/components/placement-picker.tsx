import {
  PLACEMENT_HINTS,
  PLACEMENT_LABELS,
  type PlacementPreset,
} from "@capsule/config";
import { cn } from "@capsule/ui";
import type { ReactElement } from "react";

/**
 * A miniature screen the dock can be pinned to. Choosing an edge here does
 * exactly what dragging the dock to that edge does, so the two stay legible
 * as one behaviour rather than two competing controls.
 */
const EDGE_STYLES: Record<PlacementPreset, string> = {
  "top-edge": "left-1/2 top-[6px] h-[10px] w-16 -translate-x-1/2",
  "bottom-edge": "left-[22%] bottom-[6px] h-[10px] w-16 -translate-x-1/2",
  "left-edge": "left-[6px] top-1/2 h-16 w-[10px] -translate-y-1/2",
  "right-edge": "right-[6px] top-1/2 h-16 w-[10px] -translate-y-1/2",
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
      <div className="relative mx-auto aspect-16/10 w-full max-w-sm rounded-xl border border-shell-line bg-shell-raised p-1 shadow-inner">
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-[#23232b] to-[#141419]">
          <div className="absolute inset-x-0 top-0 h-[9px] bg-black/45" />
          {/* Stand-in for the macOS Dock, so "beside the Dock" reads visually. */}
          <div className="absolute bottom-[5px] left-1/2 h-3 w-28 -translate-x-1/2 rounded-md bg-white/12" />

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
                  "absolute rounded-full transition-all",
                  EDGE_STYLES[preset],
                  selected
                    ? "bg-shell-accent shadow-[0_0_12px_rgba(0,245,138,0.55)]"
                    : "bg-white/22 hover:bg-white/40",
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {EDGE_ORDER.map((preset) => {
          const selected = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-shell-accent/60 bg-shell-accent/10"
                  : "border-shell-line bg-shell-panel hover:border-shell-line hover:bg-shell-raised",
              )}
            >
              <span className="block text-sm font-medium">
                {PLACEMENT_LABELS[preset]}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-shell-muted">
                {PLACEMENT_HINTS[preset]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
