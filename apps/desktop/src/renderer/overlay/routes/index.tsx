import {
  type CapsuleSettings,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  defaultSettings,
  dockStyleFor,
  type HudAppearance,
  hudMetrics,
  layoutForPreset,
  type ProviderId,
  placeholderSnapshots,
  type Rect,
  resolveHudTheme,
  type UsageSnapshot,
} from "@capsule/config";
import { type HitRegions, UsageDock } from "@capsule/hud";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>(() =>
    placeholderSnapshots(),
  );
  const [settings, setSettings] = useState<CapsuleSettings>(defaultSettings);
  // The main process owns where the rail sits inside the window: only it knows
  // how close the window has been pushed to a screen edge.
  const [railBias, setRailBias] = useState<number | null>(null);
  const appearance = useSystemAppearance();
  const host = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);

  const setPressed = useCallback((value: boolean) => {
    pressed.current = value;
    window.capsule?.setPointerCapture(value);
  }, []);

  useEffect(() => {
    // Losing the pointerup — the cursor left the window, or capture was
    // dropped — must not leave the dock stuck in a pressed drag.
    const release = () => {
      if (!pressed.current) {
        return;
      }
      window.capsule?.endMove();
      setPressed(false);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [setPressed]);

  useEffect(() => {
    if (!window.capsule) {
      return;
    }
    return window.capsule.onSnapshots((nextSnapshots, nextSettings) => {
      if (nextSnapshots.length > 0) {
        setSnapshots(nextSnapshots);
      }
      setSettings(nextSettings);
    });
  }, []);

  useEffect(() => {
    return window.capsule?.onRailBias(setRailBias);
  }, []);

  const layout = useMemo(
    () => layoutForPreset(settings.placementPreset),
    [settings.placementPreset],
  );
  const metrics = useMemo(
    () => hudMetrics(settings.hudScale),
    [settings.hudScale],
  );
  const theme = useMemo(
    () => resolveHudTheme(settings.hudTheme, appearance),
    [settings.hudTheme, appearance],
  );
  const dockStyle = useMemo(
    () => dockStyleFor(settings.dockStyle),
    [settings.dockStyle],
  );

  const packToEnd = layout.cardGrowth === "left" || layout.cardGrowth === "up";
  const previewOpen =
    typeof window !== "undefined" && window.location.hash === "#open";

  const onOpenChange = useCallback(
    (open: boolean, providerId: ProviderId | null) => {
      window.capsule?.setExpanded(open, providerId);
    },
    [],
  );

  // The frame reports its hit areas in its own coordinates; the main process
  // needs them relative to the window, so translate by where the frame sits.
  const lastRegions = useRef<HitRegions | null>(null);
  const publishRegions = useCallback(() => {
    const regions = lastRegions.current;
    const frame = host.current?.querySelector("[data-hud-frame]");
    if (!regions || !frame) {
      return;
    }
    const origin = frame.getBoundingClientRect();
    const shift = (rect: Rect): Rect => ({
      x: rect.x + origin.left,
      y: rect.y + origin.top,
      width: rect.width,
      height: rect.height,
    });
    const rects = [shift(regions.rail)];
    if (regions.open) {
      rects.push(shift(regions.open));
    }
    window.capsule?.setHitRegions(rects);
  }, []);

  const onHitRegions = useCallback(
    (regions: HitRegions) => {
      lastRegions.current = regions;
      requestAnimationFrame(publishRegions);
    },
    [publishRegions],
  );

  useEffect(() => {
    // Resizing the window can move the frame without changing its own rects.
    const onResize = () => requestAnimationFrame(publishRegions);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [publishRegions]);

  return (
    <div
      ref={host}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: packToEnd ? "flex-end" : "flex-start",
        alignItems: layout.cardGrowth === "up" ? "flex-end" : "flex-start",
        pointerEvents: "none",
      }}
    >
      <UsageDock
        snapshots={
          snapshots.length > 0
            ? snapshots
            : settings.demoMode
              ? DEMO_SNAPSHOTS
              : placeholderSnapshots()
        }
        metrics={metrics}
        theme={theme}
        dockStyle={dockStyle}
        orientation={layout.orientation}
        cardGrowth={layout.cardGrowth}
        notch={layout.notch}
        railBias={railBias}
        now={settings.demoMode ? new Date(DEMO_NOW_ISO) : new Date()}
        forceOpenProviderId={previewOpen ? "claude" : null}
        onOpenChange={onOpenChange}
        onPressedChange={setPressed}
        onHitRegions={onHitRegions}
        onMoveStart={(screenX, screenY) => {
          window.capsule?.startMove(screenX, screenY);
        }}
        onMoveEnd={() => {
          window.capsule?.endMove();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          window.capsule?.showContextMenu();
        }}
      />
    </div>
  );
}

function useSystemAppearance(): HudAppearance {
  const [appearance, setAppearance] = useState<HudAppearance>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setAppearance(query.matches ? "light" : "dark");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return appearance;
}
