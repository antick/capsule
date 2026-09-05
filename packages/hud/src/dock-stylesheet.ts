import { MOTION } from "@capsule/config";

/**
 * Keyframes the dock relies on, declared with the dock rather than in each
 * host's stylesheet so they work anywhere it is rendered. Reduced motion is
 * honoured here for everything CSS drives; the springs handle themselves.
 */
export const DOCK_STYLESHEET = `@keyframes capsule-sweep {
  from { transform: rotate(-90deg); }
  to { transform: rotate(270deg); }
}
@keyframes capsule-crossfade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes capsule-pulse {
  from { opacity: 1; }
  to { opacity: ${MOTION.activityPulseFloor}; }
}
@media (prefers-reduced-motion: reduce) {
  [data-usage-dock] * {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}`;
