import {
  cardHeightForBuckets,
  cardMessageHeight,
  DEMO_NOW_ISO,
  HUD,
  type HudMetrics,
  hudMetrics,
  joinOffsetForIndex,
  MOTION,
  type ProviderId,
  placeholderSnapshots,
  railLengthForCount,
  type UsageSnapshot,
} from "@capsule/config";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { type CardGrowth, HudFrame } from "./HudFrame.tsx";
import { UsageCard } from "./UsageCard.tsx";
import { UsageMeter } from "./UsageMeter.tsx";

export function UsageDock({
  snapshots,
  orientation,
  cardGrowth,
  notch = false,
  metrics: metricsProp,
  now,
  forceOpenProviderId = null,
  onOpenChange,
  onContextMenu,
  onPressedChange,
  onMoveStart,
  onMoveEnd,
}: {
  snapshots: UsageSnapshot[];
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  notch?: boolean;
  metrics?: HudMetrics;
  now?: Date;
  forceOpenProviderId?: ProviderId | null;
  onOpenChange?: (open: boolean, providerId: ProviderId | null) => void;
  onContextMenu?: (event: MouseEvent) => void;
  /** Fires while the pointer is held down, so the host can pin mouse capture. */
  onPressedChange?: (pressed: boolean) => void;
  onMoveStart?: (screenX: number, screenY: number) => void;
  onMoveEnd?: () => void;
}): ReactElement {
  const metrics = metricsProp ?? hudMetrics();
  const clock = now ?? new Date(DEMO_NOW_ISO);
  const meters = snapshots.length > 0 ? snapshots : placeholderSnapshots();
  const [hovered, setHovered] = useState<ProviderId | null>(null);
  const [pinned, setPinned] = useState<ProviderId | null>(null);
  const [dragging, setDragging] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const didDrag = useRef(false);

  const lastCard = useRef<UsageSnapshot | null>(null);
  const openId = dragging ? null : (forceOpenProviderId ?? pinned ?? hovered);
  const openSnapshot =
    meters.find((item) => item.providerId === openId) ?? null;
  if (openSnapshot) {
    lastCard.current = openSnapshot;
  }
  const cardSnapshot = openSnapshot ?? lastCard.current;
  const joinId =
    openId ?? lastCard.current?.providerId ?? snapshots[0]?.providerId ?? null;
  const activeJoinIndex = Math.max(
    0,
    meters.findIndex((item) => item.providerId === joinId),
  );

  useEffect(() => {
    onOpenChange?.(openSnapshot !== null, openSnapshot?.providerId ?? null);
  }, [openSnapshot, onOpenChange]);

  const clearTimers = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };

  const scheduleOpen = (id: ProviderId) => {
    if (dragging || didDrag.current) {
      return;
    }
    clearTimers();
    if (HUD.hoverOpenDelayMs <= 0) {
      setHovered(id);
      return;
    }
    openTimer.current = setTimeout(() => {
      setHovered(id);
    }, HUD.hoverOpenDelayMs);
  };

  const scheduleClose = () => {
    if (pinned || dragging) {
      return;
    }
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setHovered(null);
    }, HUD.hoverCloseDelayMs);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    didDrag.current = false;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      active: false,
    };
    // Capture on the dock root, never the pressed child: the rail path, card
    // and meters all re-render mid-drag, and capture dies with the old node.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released; the pointerup handler will tidy up.
    }
    onPressedChange?.(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (state.active) {
      return;
    }
    const dx = event.screenX - state.startX;
    const dy = event.screenY - state.startY;
    if (Math.hypot(dx, dy) < MOTION.dragThresholdPx) {
      return;
    }
    state.active = true;
    didDrag.current = true;
    setDragging(true);
    setPinned(null);
    setHovered(null);
    clearTimers();
    // From here the main process follows the cursor itself, so the drag keeps
    // working even when the window stops receiving pointer events.
    onMoveStart?.(event.screenX, event.screenY);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (state.active) {
      onMoveEnd?.();
    }
    setDragging(false);
    drag.current = null;
    onPressedChange?.(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Capture was already lost; nothing to release.
    }
    window.setTimeout(() => {
      didDrag.current = false;
    }, 0);
  };

  const compact = notch;

  return (
    <div
      data-usage-dock="true"
      role="application"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onPointerEnter={() => {
        if (!dragging) {
          clearTimers();
        }
      }}
      onPointerLeave={() => {
        scheduleClose();
      }}
      onContextMenu={onContextMenu}
      style={{ display: "inline-flex", pointerEvents: "none" }}
    >
      <HudFrame
        metrics={metrics}
        orientation={orientation}
        cardGrowth={cardGrowth}
        notch={notch}
        open={openSnapshot !== null}
        joinOffset={joinOffsetForIndex(metrics, activeJoinIndex, compact)}
        dragging={dragging}
        railLength={railLengthForCount(metrics, meters.length, compact)}
        cardHeight={cardHeightFor(metrics, cardSnapshot)}
        rail={meters.map((snapshot) => (
          <UsageMeter
            metrics={metrics}
            key={snapshot.providerId}
            providerId={snapshot.providerId}
            percent={snapshot.primaryPercent}
            active={openId === snapshot.providerId}
            compact={compact}
            onPointerEnter={() => scheduleOpen(snapshot.providerId)}
            onPointerLeave={() => undefined}
            onClick={() => {
              if (didDrag.current) {
                didDrag.current = false;
                return;
              }
              setPinned((current) =>
                current === snapshot.providerId ? null : snapshot.providerId,
              );
              setHovered(snapshot.providerId);
            }}
          />
        ))}
        card={
          cardSnapshot ? (
            <div
              style={{ width: "100%", height: "100%" }}
              onPointerEnter={() => {
                if (!dragging) {
                  clearTimers();
                  setHovered(cardSnapshot.providerId);
                }
              }}
            >
              <UsageCard
                metrics={metrics}
                snapshot={cardSnapshot}
                now={clock}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
}

function cardHeightFor(
  metrics: HudMetrics,
  snapshot: UsageSnapshot | null,
): number {
  const count = snapshot?.buckets.length ?? 0;
  if (count === 0 || snapshot?.status === "unauthenticated") {
    return cardMessageHeight(metrics);
  }
  return cardHeightForBuckets(metrics, count);
}
