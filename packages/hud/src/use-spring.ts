import {
  SPRING_MAX_FRAME_SECONDS,
  type Spring,
  type SpringState,
  springSettled,
  stepSpring,
} from "@capsule/config";
import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the system has asked for less movement. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * A number that follows `target` on a spring rather than jumping to it.
 *
 * Stepped every frame, so a target that changes mid-flight keeps the momentum
 * the value already has: a quick hover in and out reads as one gesture, not
 * as an animation being cut off and another started. Snaps straight to the
 * target when the system asks for reduced motion.
 */
export function useSpring(target: number, spring: Spring): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const state = useRef<SpringState>({ value: target, velocity: 0 });
  const scale = useRef(Math.abs(target));

  useEffect(() => {
    const current = state.current;
    if (reduced) {
      current.value = target;
      current.velocity = 0;
      setValue(target);
      return;
    }
    if (current.value === target && current.velocity === 0) {
      return;
    }
    // How far this leg travels sets how close "arrived" has to be, so a
    // fraction between 0 and 1 and a distance in the hundreds of pixels both
    // settle at the same visual precision.
    scale.current = Math.max(
      Math.abs(target),
      Math.abs(target - current.value),
    );
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const dt = Math.min(SPRING_MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      stepSpring(spring, current, target, dt);
      if (springSettled(current, target, scale.current)) {
        current.value = target;
        current.velocity = 0;
        setValue(target);
        return;
      }
      setValue(current.value);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, spring, reduced]);

  return value;
}
