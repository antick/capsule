import {
  type ActivityNotice,
  type AgentSession,
  DEMO_NOW_ISO,
  DOCK_STYLES,
  HUD,
  HUD_THEMES,
  hudMetrics,
  joinedNotchRailLength,
  joinOffsetForIndex,
  MOTION,
  type ProviderId,
  placeholderSnapshots,
  railEndSpread,
  railLengthForCount,
  styleSupportsNotch,
  summarizeActivity,
  type UsageSnapshot,
} from "@capsule/config";
import {
  type MouseEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { CornerFrame } from "./CornerFrame.tsx";
import { DockCard, dockCardHeight } from "./DockCard.tsx";
import { DOCK_STYLESHEET } from "./dock-stylesheet.ts";
import { HudFrame } from "./HudFrame.tsx";
import { stowShift } from "./latch-path.ts";
import { UsageMeter } from "./UsageMeter.tsx";
import type { UsageDockProps } from "./usage-dock-props.ts";
import { useActivityNotices } from "./use-activity-notices.ts";
import { useDockDrag } from "./use-dock-drag.ts";

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
  autoHide = false,
  keepOpen = false,
  onKeepOpenChange,
  activity = {},
  notices,
  onDismissNotice,
  hardwareNotch = null,
  pointerInside = null,
  revealNonce = 0,
  forceOpenProviderId = null,
  onOpenChange,
  onRefresh,
  onAgents,
  onContextMenu,
  onPressedChange,
  onMoveStart,
  onMoveEnd,
  onHitRegions,
  tokens = {},
  usageDisplay = "used",
  hideDelayMs = MOTION.peekHoldMs,
}: UsageDockProps): ReactElement {
  const notice = useActivityNotices(notices, pointerInside);
  const metrics = metricsProp ?? hudMetrics();
  const clock = now ?? new Date(DEMO_NOW_ISO);
  const meters = snapshots.length > 0 ? snapshots : placeholderSnapshots();
  const [hovered, setHovered] = useState<ProviderId | null>(null);
  const [pinned, setPinned] = useState<ProviderId | null>(null);
  const [woken, setWoken] = useState(false);
  const [held, setHeld] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { dragging, didDrag, handlers } = useDockDrag({
    onPressedChange,
    onMoveStart,
    onMoveEnd,
    onDragBegin: () => {
      notice.close();
      setPinned(null);
      setHovered(null);
      clearTimers();
    },
  });

  // Retracted until something asks for it: a preview, a drag, the pointer,
  // or a standing request to keep it out.
  const peek =
    autoHide &&
    !woken &&
    !held &&
    !dragging &&
    !keepOpen &&
    notice.providerId === null &&
    notice.waiting.length === 0 &&
    forceOpenProviderId === null;

  const lastCard = useRef<UsageSnapshot | null>(null);
  const openId =
    dragging || peek
      ? null
      : (notice.providerId ?? forceOpenProviderId ?? pinned ?? hovered);
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

  // Turning auto-hide on puts the dock away rather than waiting for the
  // pointer to leave first.
  useEffect(() => {
    if (autoHide) {
      setWoken(false);
    }
  }, [autoHide]);

  const clearTimers = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
    }
  };

  const wake = () => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
    }
    setWoken(true);
  };

  const scheduleSleep = () => {
    if (!autoHide || pinned || dragging || held || keepOpen) {
      return;
    }
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
    }
    peekTimer.current = setTimeout(() => {
      setWoken(false);
    }, hideDelayMs);
  };

  const scheduleOpen = (id: ProviderId) => {
    if (dragging || didDrag.current) {
      return;
    }
    clearTimers();
    notice.close();
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

  /**
   * The cursor has gone. Unlike a hover-out this also drops a pinned card:
   * pinning is only meant to hold a card still while you are on the dock, and
   * a pin that survives leaving would strand the card open with nothing left
   * on screen to dismiss it.
   */
  const leave = () => {
    if (dragging) {
      return;
    }
    setPinned(null);
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setHovered(null);
    }, HUD.hoverCloseDelayMs);
    if (autoHide && !held && !keepOpen) {
      peekTimer.current = setTimeout(() => {
        setWoken(false);
      }, hideDelayMs);
    }
  };

  // The host's hit test is the authority on the pointer having left; the DOM
  // only ever reliably reports it arriving. Held in refs so the effect can
  // depend on the signal alone rather than on every render's closures.
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  const wakeRef = useRef(wake);
  wakeRef.current = wake;
  const pointerInsideRef = useRef(pointerInside);
  pointerInsideRef.current = pointerInside;
  useEffect(() => {
    if (pointerInside === null) {
      return;
    }
    if (pointerInside) {
      wakeRef.current();
      return;
    }
    leaveRef.current();
  }, [pointerInside]);

  // "Show Dock": unroll and stay put for a beat, then go back to whatever the
  // cursor says. Leaving it out for good would defeat hiding it in the first
  // place, so the hold expires on its own.
  useEffect(() => {
    if (revealNonce === 0) {
      return;
    }
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
    }
    setWoken(true);
    setHeld(true);
    holdTimer.current = setTimeout(() => {
      setHeld(false);
      if (pointerInsideRef.current !== true) {
        setWoken(false);
      }
    }, MOTION.revealHoldMs);
    return () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
      }
    };
  }, [revealNonce]);

  // A horizontal dock has to fit a meter's full height inside the rail's
  // thickness, so the percent caption is dropped rather than overflowing it.
  // A corner arc is the same story: the caption has nowhere to sit on a band
  // that curves away under it.
  const compact = orientation === "horizontal" || corner !== null;
  const isNotch = notch && styleSupportsNotch(dockStyle);
  const shift = stowShift(metrics, cardGrowth);
  // Sharing the bezel with the display's own notch, the rail is at least as
  // wide as the hardware, and the meters stay centred in the extra length.
  const joined = isNotch && corner === null ? hardwareNotch : null;
  const railLength = joined
    ? joinedNotchRailLength(metrics, meters.length, joined)
    : railLengthForCount(metrics, meters.length, compact);
  const spread = railEndSpread(metrics, meters.length, compact, railLength);
  const cardSessions: AgentSession[] = cardSnapshot
    ? (activity[cardSnapshot.providerId] ?? [])
    : [];
  const lastNotices = useRef<ActivityNotice[]>([]);
  if (openId) lastNotices.current = notice.providerId ? notice.visible : [];
  const cardNotices = openId
    ? notice.providerId
      ? notice.visible
      : []
    : lastNotices.current;
  const cardTokens = cardSnapshot
    ? (tokens[cardSnapshot.providerId] ?? null)
    : null;
  const cardHeight = dockCardHeight(
    metrics,
    cardSnapshot,
    cardSessions.length,
    cardNotices.length,
    cardTokens !== null,
  );
  // What a folded dock says at a glance: amber if any agent is waiting on you,
  // white if any is working, nothing otherwise.
  const overall = summarizeActivity(Object.values(activity).flat())?.state;
  const beacon =
    notice.waiting.length > 0 || overall === "waiting"
      ? "waiting"
      : overall === "working"
        ? "working"
        : null;

  /**
   * A click on the rail itself — not a meter, not the card — holds the dock
   * out, or lets it go again. Only meaningful when it hides by itself.
   */
  const onRailClick = (event: MouseEvent<HTMLDivElement>) => {
    if (didDrag.current || !autoHide) {
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest("[data-provider], [data-card-wrap]")) {
      return;
    }
    onKeepOpenChange?.(!keepOpen);
  };

  const meterNodes = meters.map((snapshot, index) => (
    <UsageMeter
      metrics={metrics}
      theme={theme}
      key={snapshot.providerId}
      providerId={snapshot.providerId}
      percent={snapshot.primaryPercent}
      display={usageDisplay}
      active={openId === snapshot.providerId}
      compact={compact}
      refreshing={snapshot.refreshing === true}
      activity={summarizeActivity(activity[snapshot.providerId])}
      noticeCount={notice.countFor(snapshot.providerId)}
      waitingCount={
        notice.waiting.filter((item) => item.providerId === snapshot.providerId)
          .length
      }
      stowed={peek}
      stowShift={shift}
      revealDelayMs={Math.min(
        index * MOTION.meterStaggerMs,
        MOTION.meterStaggerCapMs,
      )}
      onPointerEnter={() => scheduleOpen(snapshot.providerId)}
      onPointerLeave={() => undefined}
      onNoticeClick={() => {
        setPinned(null);
        setHovered(null);
        notice.reopen(snapshot.providerId);
      }}
      onClick={() => {
        if (didDrag.current) {
          didDrag.current = false;
          return;
        }
        notice.close();
        wake();
        setPinned((current) =>
          current === snapshot.providerId ? null : snapshot.providerId,
        );
        setHovered(snapshot.providerId);
        // Asking for a provider re-reads it, which is what puts the sweep on
        // its ring and lands a fresh number underneath.
        onRefresh?.(snapshot.providerId);
        onAgents?.(snapshot.providerId);
      }}
    />
  ));

  const cardNode = cardSnapshot ? (
    <DockCard
      snapshot={cardSnapshot}
      sessions={cardSessions}
      notices={cardNotices}
      tokens={cardTokens}
      display={usageDisplay}
      metrics={metrics}
      theme={theme}
      now={clock}
      onDismissNotice={onDismissNotice}
      onPointerEnter={() => {
        if (!dragging) {
          clearTimers();
          if (notice.providerId) notice.pause();
          else setHovered(cardSnapshot.providerId);
        }
      }}
      onPointerLeave={notice.resume}
    />
  ) : null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the dock is a click-through overlay that never takes keyboard focus; the menu bar carries the keyboard route to the same command.
    <div
      data-usage-dock="true"
      role="application"
      {...handlers}
      onClick={onRailClick}
      onPointerEnter={() => {
        if (!dragging) {
          clearTimers();
          wake();
        }
      }}
      onPointerLeave={() => {
        // Only when nothing better is available. The rail sliding out from
        // under a stationary cursor raises pointerleave all by itself, so
        // acting on it would retract the dock the user just called up.
        if (pointerInside === null) {
          scheduleClose();
          scheduleSleep();
        }
      }}
      onContextMenu={onContextMenu}
      style={{ display: "inline-flex", pointerEvents: "none" }}
    >
      {/* Declared with the dock rather than in each host's stylesheet, so the
          keyframes work anywhere the dock is rendered. */}
      <style>{DOCK_STYLESHEET}</style>
      {corner ? (
        <CornerFrame
          metrics={metrics}
          theme={theme}
          style={dockStyle}
          corner={corner}
          open={openSnapshot !== null}
          dragging={dragging}
          activeIndex={activeJoinIndex}
          cardHeight={cardHeight}
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
          joinOffset={
            joinOffsetForIndex(metrics, activeJoinIndex, compact) + spread
          }
          dragging={dragging}
          railLength={railLength}
          cardHeight={cardHeight}
          railBias={railBias}
          peek={peek}
          hardwareNotch={joined}
          beacon={beacon}
          onHitRegions={onHitRegions}
          rail={meterNodes}
          card={cardNode}
        />
      )}
    </div>
  );
}
