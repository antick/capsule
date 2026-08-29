import {
  type CapsuleSettings,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  defaultSettings,
  layoutForPreset,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import { UsageDock } from "@capsule/hud";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>(DEMO_SNAPSHOTS);
  const [settings, setSettings] = useState<CapsuleSettings>(defaultSettings);
  const dragging = useRef(false);
  const lastCapture = useRef<boolean | null>(null);

  const setCapture = useCallback((capture: boolean) => {
    if (lastCapture.current === capture) {
      return;
    }
    lastCapture.current = capture;
    window.capsule?.setPointerCapture(capture);
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragging.current) {
        setCapture(true);
        return;
      }
      const el = document.elementFromPoint(event.clientX, event.clientY);
      setCapture(Boolean(el?.closest('[data-hud-hit="true"]')));
    };
    const onLeave = () => {
      if (!dragging.current) {
        setCapture(false);
      }
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        window.capsule?.endMove();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setCapture]);

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

  const layout = useMemo(
    () => layoutForPreset(settings.placementPreset),
    [settings.placementPreset],
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

  return (
    <div
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
        snapshots={snapshots}
        orientation={layout.orientation}
        cardGrowth={layout.cardGrowth}
        now={settings.demoMode ? new Date(DEMO_NOW_ISO) : new Date()}
        forceOpenProviderId={previewOpen ? "claude" : null}
        onOpenChange={onOpenChange}
        onMoveStart={(screenX, screenY) => {
          dragging.current = true;
          setCapture(true);
          window.capsule?.startMove(screenX, screenY);
        }}
        onMove={(screenX, screenY) => {
          window.capsule?.moveWindow(screenX, screenY);
        }}
        onMoveEnd={() => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
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
