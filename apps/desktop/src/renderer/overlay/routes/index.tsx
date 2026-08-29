import {
  type CapsuleSettings,
  cornerIsBottom,
  cornerIsRight,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  defaultSettings,
  dockStyleFor,
  type HudAppearance,
  hudMetrics,
  layoutForPreset,
  MOTION,
  type ProviderId,
  placeholderSnapshots,
  type Rect,
  resolveHudTheme,
  type UsageSnapshot,
} from "@capsule/config";
import { type HitRegions, UsageDock, useAnimatedNumber } from "@capsule/hud";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DockFrame } from "../../../preload/index.ts";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>(() =>
    placeholderSnapshots(),
  );
  const [settings, setSettings] = useState<CapsuleSettings>(defaultSettings);
  // The main process owns where the rail sits inside the window, and whether
  // the dock has curled into a corner: only it knows how close the window has
  // been pushed to a screen edge.
  const [frame, setFrame] = useState<DockFrame>({
    railBias: 0,
    corner: null,
  });
  // Null until main's hit test has spoken, so the dock keeps trusting the DOM
  // on the very first frames.
  const [pointerInside, setPointerInside] = useState<boolean | null>(null);
  // Counter rather than a flag: asking twice in a row has to reveal twice.
  const [revealNonce, setRevealNonce] = useState(0);
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
    return window.capsule?.onDockFrame(setFrame);
  }, []);

  useEffect(() => {
    return window.capsule?.onPointerInside(setPointerInside);
  }, []);

  useEffect(() => {
    return window.capsule?.onRevealDock(() => {
      setRevealNonce((current) => current + 1);
    });
  }, []);

  const refreshProvider = useCallback((providerId: ProviderId) => {
    window.capsule?.refreshProvider(providerId);
  }, []);

  const layout = useMemo(
    () => layoutForPreset(settings.placementPreset),
    [settings.placementPreset],
  );
  // Resizing eases through the sizes in between rather than snapping. The
  // window is only ever the bigger of the two ends while this runs, so the
  // artwork can grow into it or shrink away from it without being clipped.
  const scale = useAnimatedNumber(settings.hudScale, MOTION.zoomMs);
  const metrics = useMemo(() => hudMetrics(scale), [scale]);
  const theme = useMemo(
    () => resolveHudTheme(settings.hudTheme, appearance),
    [settings.hudTheme, appearance],
  );
  const dockStyle = useMemo(
    () => dockStyleFor(settings.dockStyle),
    [settings.dockStyle],
  );

  // The frame is pinned against the docked edge, and against the start of the
  // edge it slides along — the rail bias does the rest of the positioning.
  // That only shows while a resize is easing and the window is the larger of
  // the two sizes, but it has to be right or the dock drifts as it zooms.
  const packToEnd = frame.corner
    ? cornerIsRight(frame.corner)
    : layout.cardGrowth === "left";
  const packToBottom = frame.corner
    ? cornerIsBottom(frame.corner)
    : layout.cardGrowth === "up";
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
    const rects = regions.rail.map(shift);
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
        alignItems: packToBottom ? "flex-end" : "flex-start",
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
        railBias={frame.railBias}
        corner={frame.corner}
        autoHide={settings.autoHide}
        pointerInside={pointerInside}
        revealNonce={revealNonce}
        onRefresh={refreshProvider}
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
