/**
 * The dock's motion vocabulary, in one place so the whole surface moves like
 * one thing.
 *
 * Springs rather than eased curves. macOS motion reads as physical because
 * things arrive with momentum and settle, and a panel on a fixed-duration
 * cubic-bezier reads as a slideshow by comparison. A spring is also
 * velocity-continuous: retarget it half-way and it carries its speed into the
 * new destination instead of restarting from rest.
 *
 * Described the way SwiftUI describes them — `response` is the period of the
 * undamped oscillation in seconds, `damping` the damping fraction — so the
 * numbers can be read against the reference implementation directly.
 */
export interface Spring {
  response: number;
  damping: number;
}

export const SPRINGS = {
  /**
   * Folding open and shut. Long enough to read as a movement, short enough
   * that it never delays you. Damped to a single soft settle, not a wobble.
   */
  unfold: { response: 0.42, damping: 0.78 },
  /** Contents arriving after the shape has started opening. */
  contents: { response: 0.36, damping: 0.82 },
  /**
   * The card travelling between meters, and its height following a swap. A
   * bigger object moving a longer way, so slower and more damped than the
   * fold: the spring that feels crisp on a ring feels abrupt on a card.
   */
  glide: { response: 0.5, damping: 0.86 },
  /**
   * A percentage changing under you. Slow on purpose: a ring that snaps to a
   * new value reads as a glitch, one that sweeps reads as a measurement.
   */
  reading: { response: 0.9, damping: 0.9 },
  /** A ring pressed in while it works, and released when the answer lands. */
  press: { response: 0.3, damping: 0.62 },
} as const satisfies Record<string, Spring>;

export type SpringId = keyof typeof SPRINGS;

/** How close to its target a spring has to be before it counts as arrived. */
export const SPRING_SETTLE_EPSILON = 0.001;

/**
 * How many points a spring is sampled at when it is handed to CSS. Enough
 * that the early, fast part of the curve keeps its shape; few enough that the
 * easing string stays short.
 */
export const SPRING_EASING_SAMPLES = 48;

/** Substep used when a spring is stepped frame by frame, in seconds. */
export const SPRING_STEP_SECONDS = 1 / 240;

/**
 * The longest frame gap a stepped spring will simulate. Anything longer is a
 * window that was asleep, and catching up on all of it at once would land the
 * spring with a jolt rather than a settle.
 */
export const SPRING_MAX_FRAME_SECONDS = 1 / 15;

function omega(spring: Spring): number {
  return (2 * Math.PI) / Math.max(1e-6, spring.response);
}

/**
 * Where a spring released from rest at 0 and aimed at 1 is after `seconds`.
 * Closed form, so a CSS curve can be sampled without simulating anything.
 */
export function springPosition(spring: Spring, seconds: number): number {
  if (seconds <= 0) {
    return 0;
  }
  const w0 = omega(spring);
  const zeta = Math.max(0, spring.damping);
  const t = seconds;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * w0 * t);
    return (
      1 - decay * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
    );
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const root = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + root;
  const r2 = -zeta * w0 - root;
  // y(0) = -1 and y'(0) = 0 fix the two coefficients.
  const c1 = r2 / (r1 - r2);
  const c2 = -1 - c1;
  return 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

/**
 * How long the spring takes to come within `epsilon` of its target and stay
 * there. For an underdamped spring that is the decay envelope; a critically
 * or overdamped one is walked until it is close enough.
 */
export function springSettleSeconds(
  spring: Spring,
  epsilon: number = SPRING_SETTLE_EPSILON,
): number {
  const w0 = omega(spring);
  const zeta = Math.max(1e-3, spring.damping);
  if (zeta < 1) {
    const envelope = 1 / Math.sqrt(1 - zeta * zeta);
    return Math.log(envelope / epsilon) / (zeta * w0);
  }
  let t = 0;
  const step = spring.response / 50;
  while (Math.abs(1 - springPosition(spring, t)) > epsilon && t < 10) {
    t += step;
  }
  return t;
}

export function springSettleMs(spring: Spring): number {
  return Math.round(springSettleSeconds(spring) * 1000);
}

/**
 * The spring as a CSS `linear()` easing, sampled evenly over its settle time.
 * CSS cannot run a spring itself, but it can follow one point by point, and at
 * this sample count the difference is not visible.
 */
export function springEasing(
  spring: Spring,
  samples: number = SPRING_EASING_SAMPLES,
): string {
  const duration = springSettleSeconds(spring);
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * duration;
    const value = index === samples ? 1 : springPosition(spring, t);
    points.push(value.toFixed(4).replace(/\.?0+$/, "") || "0");
  }
  return `linear(${points.join(", ")})`;
}

const transitions = new WeakMap<Spring, SpringTransition>();

export interface SpringTransition {
  durationMs: number;
  easing: string;
}

/** Duration and easing for a CSS transition that follows this spring. */
export function springTransition(spring: Spring): SpringTransition {
  const cached = transitions.get(spring);
  if (cached) {
    return cached;
  }
  const next = {
    durationMs: springSettleMs(spring),
    easing: springEasing(spring),
  };
  transitions.set(spring, next);
  return next;
}

/** A spring in flight: where it is and how fast it is moving. */
export interface SpringState {
  value: number;
  velocity: number;
}

/**
 * Advances a spring toward `target` by `seconds`, in place. Stepped rather than
 * solved, so a target that moves mid-flight keeps the momentum the spring
 * already has — that carry-over is what makes a quick hover in and out feel
 * like one gesture rather than two animations.
 */
export function stepSpring(
  spring: Spring,
  state: SpringState,
  target: number,
  seconds: number,
): SpringState {
  const w0 = omega(spring);
  const stiffness = w0 * w0;
  const friction = 2 * Math.max(0, spring.damping) * w0;
  let remaining = Math.max(0, seconds);
  while (remaining > 0) {
    const h = Math.min(SPRING_STEP_SECONDS, remaining);
    const acceleration =
      -stiffness * (state.value - target) - friction * state.velocity;
    state.velocity += acceleration * h;
    state.value += state.velocity * h;
    remaining -= h;
  }
  return state;
}

/** Whether a stepped spring is close enough to `target` to be snapped onto it. */
export function springSettled(
  state: SpringState,
  target: number,
  scale: number,
): boolean {
  const tolerance = SPRING_SETTLE_EPSILON * Math.max(1, Math.abs(scale));
  return (
    Math.abs(state.value - target) < tolerance &&
    Math.abs(state.velocity) < tolerance * 10
  );
}
