import {
  DEMO_NOW_ISO,
  HUD,
  type ProviderId,
  type UsageSnapshot,
} from "@capsule/config";
import {
  type MouseEvent,
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
}: {
  snapshots: UsageSnapshot[];
  orientation: "vertical" | "horizontal";
  cardGrowth: CardGrowth;
  now?: Date;
  forceOpenProviderId?: ProviderId | null;
  onOpenChange?: (open: boolean, providerId: ProviderId | null) => void;
  onContextMenu?: (event: MouseEvent) => void;
}): ReactElement {
  const clock = now ?? new Date(DEMO_NOW_ISO);
  const [hovered, setHovered] = useState<ProviderId | null>(null);
  const [pinned, setPinned] = useState<ProviderId | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openId = forceOpenProviderId ?? pinned ?? hovered;
  const openSnapshot =
    snapshots.find((item) => item.providerId === openId) ?? null;

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
    clearTimers();
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
    joinIndex * (HUD.meterSize + HUD.itemGap + 18) +
    HUD.meterSize / 2;

  return (
    <div
      data-usage-dock="true"
      role="application"
      onPointerLeave={() => {
        if (!pinned) {
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
        rail={snapshots.map((snapshot) => (
          <UsageMeter
            key={snapshot.providerId}
            providerId={snapshot.providerId}
            percent={snapshot.primaryPercent}
            active={openId === snapshot.providerId}
            onPointerEnter={() => scheduleOpen(snapshot.providerId)}
            onPointerLeave={() => undefined}
            onClick={() => {
              setPinned((current) =>
                current === snapshot.providerId ? null : snapshot.providerId,
              );
              setHovered(snapshot.providerId);
            }}
          />
        ))}
        card={
          openSnapshot ? (
            <div
              onPointerEnter={() => {
                clearTimers();
                setHovered(openSnapshot.providerId);
              }}
            >
              <UsageCard snapshot={openSnapshot} now={clock} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
