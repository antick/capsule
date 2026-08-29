import {
  type CapsuleSettings,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  defaultSettings,
  hudMetrics,
  layoutForPreset,
  type ProviderId,
  placeholderSnapshots,
  type UsageSnapshot,
} from "@capsule/config";
import { UsageDock } from "@capsule/hud";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function OverlayHud() {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>(() =>
    placeholderSnapshots(),
  );
  const [settings, setSettings] = useState<CapsuleSettings>(defaultSettings);
  // Held from pointerdown until pointerup, which is wider than `dragging`:
  // click-through must stay off during the pre-threshold press too, or the
  // window goes transparent to the mouse before the drag ever starts.
  const pressed = useRef(false);
  const lastCapture = useRef<boolean | null>(null);

  const setCapture = useCallback((capture: boolean) => {
    const next = capture || pressed.current;
    if (lastCapture.current === next) {
      return;
    }
    lastCapture.current = next;
    window.capsule?.setPointerCapture(next);
  }, []);

  const setPressed = useCallback(
    (value: boolean) => {
      pressed.current = value;
      setCapture(value);
    },
    [setCapture],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (pressed.current) {
        return;
      }
      const el = document.elementFromPoint(event.clientX, event.clientY);
      setCapture(Boolean(el?.closest('[data-hud-hit="true"]')));
    };
    const onLeave = () => {
      if (!pressed.current) {
        setCapture(false);
      }
    };
    // Safety net: if the dock never sees the release (the pointer left the
    // window, or capture was lost), end the drag anyway.
    const onUp = () => {
      if (pressed.current) {
        pressed.current = false;
        window.capsule?.endMove();
        setCapture(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
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
  const metrics = useMemo(
    () => hudMetrics(settings.hudScale),
    [settings.hudScale],
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
        snapshots={
          snapshots.length > 0
            ? snapshots
            : settings.demoMode
              ? DEMO_SNAPSHOTS
              : placeholderSnapshots()
        }
        metrics={metrics}
        orientation={layout.orientation}
        cardGrowth={layout.cardGrowth}
        notch={layout.notch}
        now={settings.demoMode ? new Date(DEMO_NOW_ISO) : new Date()}
        forceOpenProviderId={previewOpen ? "claude" : null}
        onOpenChange={onOpenChange}
        onPressedChange={setPressed}
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
