import type { HudAppearance } from "@capsule/config";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function read(): HudAppearance {
  return window.matchMedia?.(QUERY).matches ? "dark" : "light";
}

/**
 * Which appearance macOS is in. The settings window follows it, and so does
 * anything previewing what `auto` will resolve to.
 */
export function useSystemAppearance(): HudAppearance {
  return useSyncExternalStore(subscribe, read, () => "light" as HudAppearance);
}
