import {
  DEMO_NOW_ISO,
  HUD,
  MOTION,
  type ProviderId,
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
  now,
  forceOpenProviderId = null,
  onOpenChange,
  onContextMenu,
  onMoveStart,
  onMove,
  onMoveEnd,
}: {
  snapshots: UsageSnapshot[];
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  now?: Date;
  forceOpenProviderId?: ProviderId | null;
  onOpenChange?: (open: boolean, providerId: ProviderId | null) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onMoveStart?: (screenX: number, screenY: number) => void;
  onMove?: (screenX: number, screenY: number) => void;
  onMoveEnd?: () => void;
}): ReactElement {
  const clock = now ?? new Date(DEMO_NOW_ISO);
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
    snapshots.find((item) => item.providerId === openId) ?? null;
  if (openSnapshot) {
    lastCard.current = openSnapshot;
  }
  const cardSnapshot = openSnapshot ?? lastCard.current;

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
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setHovered(null);
    }, HUD.hoverCloseDelayMs);
  };

  const joinIndex = Math.max(
    0,
    snapshots.findIndex((item) => item.providerId === openId),
  );
  const joinOffset =
    HUD.railPaddingY +
    joinIndex * (HUD.meterSize + HUD.itemGap + HUD.percentBlock) +
    HUD.meterSize / 2;

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
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.screenX - state.startX;
    const dy = event.screenY - state.startY;
    const distance = Math.hypot(dx, dy);
    if (!state.active && distance >= MOTION.dragThresholdPx) {
      state.active = true;
      didDrag.current = true;
      setDragging(true);
      setPinned(null);
      setHovered(null);
      clearTimers();
      onMoveStart?.(event.screenX, event.screenY);
    }
    if (state.active) {
      onMove?.(event.screenX, event.screenY);
    }
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
  };

  return (
    <div
      data-usage-dock="true"
      role="application"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerLeave={() => {
        if (!pinned && !dragging) {
          scheduleClose();
        }
      }}
      onContextMenu={onContextMenu}
      style={{ display: "inline-flex" }}
    >
      <HudFrame
        orientation={orientation}
        cardGrowth={cardGrowth}
        open={openSnapshot !== null}
        joinOffset={joinOffset}
        dragging={dragging}
        rail={snapshots.map((snapshot) => (
          <UsageMeter
            key={snapshot.providerId}
            providerId={snapshot.providerId}
            percent={snapshot.primaryPercent}
            active={openId === snapshot.providerId}
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
              onPointerEnter={() => {
                if (!dragging) {
                  clearTimers();
                  setHovered(cardSnapshot.providerId);
                }
              }}
            >
              <UsageCard snapshot={cardSnapshot} now={clock} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
