import { MOTION, SPRINGS, springTransition } from "@capsule/config";
import type { CSSProperties } from "react";

/**
 * The card and its bubble popping out of the rail, and being drawn back in.
 * Shared by every frame so the silhouette and the text move as one. Out on
 * the fold spring, so it arrives with momentum and settles; back in on an
 * ease-in, because a thing being absorbed accelerates as it goes.
 */
export function cardReveal(visible: boolean): CSSProperties {
  const open = springTransition(SPRINGS.unfold);
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : `scale(${MOTION.closedBubbleScale})`,
    transition: visible
      ? `opacity ${MOTION.openMs}ms ${MOTION.easing}, transform ${open.durationMs}ms ${open.easing}`
      : `opacity ${MOTION.closeMs}ms ${MOTION.closeEasing}, transform ${MOTION.closeMs}ms ${MOTION.closeEasing}`,
    willChange: "transform, opacity",
  };
}
