import { MOTION } from "@capsule/config";
import { type PointerEvent, useRef, useState } from "react";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

/**
 * Turns a press on the dock into a move once the pointer has travelled far
 * enough, and hands the cursor to the host from there: a click-through
 * overlay stops receiving pointer events the moment it is no longer under the
 * cursor, so the renderer cannot be the source of truth for a drag.
 */
export function useDockDrag(options: {
  onPressedChange?: (pressed: boolean) => void;
  onMoveStart?: (screenX: number, screenY: number) => void;
  onMoveEnd?: () => void;
  /** The press has become a drag: drop any hover state before it moves. */
  onDragBegin: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<DragState | null>(null);
  /** Set for the rest of the gesture, so its click is not taken as a click. */
  const didDrag = useRef(false);

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
    options.onPressedChange?.(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || state.active) {
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
    options.onDragBegin();
    options.onMoveStart?.(event.screenX, event.screenY);
  };

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    if (state.active) {
      options.onMoveEnd?.();
    }
    setDragging(false);
    drag.current = null;
    options.onPressedChange?.(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Capture was already lost; nothing to release.
    }
    window.setTimeout(() => {
      didDrag.current = false;
    }, 0);
  };

  return {
    dragging,
    didDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    },
  };
}
