import {
  type Corner,
  cardHeightForBuckets,
  cardMessageHeight,
  DEMO_NOW_ISO,
  DOCK_STYLES,
  type DockStyle,
  HUD,
  HUD_THEMES,
  type HudMetrics,
  type HudTheme,
  hudMetrics,
  joinOffsetForIndex,
  MOTION,
  type ProviderId,
  placeholderSnapshots,
  railLengthForCount,
  styleSupportsNotch,
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
import { CornerFrame } from "./CornerFrame.tsx";
import { type CardGrowth, type HitRegions, HudFrame } from "./HudFrame.tsx";
import { UsageCard } from "./UsageCard.tsx";
import { UsageMeter } from "./UsageMeter.tsx";

export function UsageDock({
  snapshots,
  orientation,
  cardGrowth,
  notch = false,
  metrics: metricsProp,
  theme = HUD_THEMES.midnight,
  dockStyle = DOCK_STYLES.rail,
  now,
  railBias = null,
  corner = null,
  forceOpenProviderId = null,
  onOpenChange,
  onContextMenu,
  onPressedChange,
  onMoveStart,
  onMoveEnd,
  onHitRegions,
}: {
  snapshots: UsageSnapshot[];
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  notch?: boolean;
  metrics?: HudMetrics;
  theme?: HudTheme;
  dockStyle?: DockStyle;
  now?: Date;
  /** Where the rail sits inside its frame; the main process owns this. */
  railBias?: number | null;
  /** Set when the dock has curled into a screen corner as an arc. */
  corner?: Corner | null;
  forceOpenProviderId?: ProviderId | null;
  onOpenChange?: (open: boolean, providerId: ProviderId | null) => void;
  onContextMenu?: (event: MouseEvent) => void;
  /** Fires while the pointer is held down, so the host can pin mouse capture. */
  onPressedChange?: (pressed: boolean) => void;
  onMoveStart?: (screenX: number, screenY: number) => void;
  onMoveEnd?: () => void;
  /** Reports the areas that should swallow the mouse, local to the dock. */
  onHitRegions?: (regions: HitRegions) => void;
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

  // A horizontal dock has to fit a meter's full height inside the rail's
  // thickness, so the percent caption is dropped rather than overflowing it.
  // A corner arc is the same story: the caption has nowhere to sit on a band
  // that curves away under it.
  const compact = orientation === "horizontal" || corner !== null;
  const isNotch = notch && styleSupportsNotch(dockStyle);

  const meterNodes = meters.map((snapshot) => (
    <UsageMeter
      metrics={metrics}
      theme={theme}
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
  ));

  const cardNode = cardSnapshot ? (
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
        theme={theme}
        snapshot={cardSnapshot}
        now={clock}
      />
    </div>
  ) : null;

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
      {corner ? (
        <CornerFrame
          metrics={metrics}
          theme={theme}
          style={dockStyle}
          corner={corner}
          open={openSnapshot !== null}
          dragging={dragging}
          activeIndex={activeJoinIndex}
          cardHeight={cardHeightFor(metrics, cardSnapshot)}
          onHitRegions={onHitRegions}
          meters={meterNodes}
          card={cardNode}
        />
      ) : (
        <HudFrame
          metrics={metrics}
          theme={theme}
          style={dockStyle}
          orientation={orientation}
          cardGrowth={cardGrowth}
          notch={isNotch}
          compact={compact}
          open={openSnapshot !== null}
          joinOffset={joinOffsetForIndex(metrics, activeJoinIndex, compact)}
          dragging={dragging}
          railLength={railLengthForCount(metrics, meters.length, compact)}
          cardHeight={cardHeightFor(metrics, cardSnapshot)}
          railBias={railBias}
          onHitRegions={onHitRegions}
          rail={meterNodes}
          card={cardNode}
        />
      )}
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
