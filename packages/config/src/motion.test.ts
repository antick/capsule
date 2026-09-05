import { describe, expect, it } from "vitest";
import {
  SPRINGS,
  springEasing,
  springPosition,
  springSettled,
  springSettleSeconds,
  springTransition,
  stepSpring,
} from "./motion.ts";

describe("springPosition", () => {
  it("starts at rest and arrives at one", () => {
    for (const spring of Object.values(SPRINGS)) {
      expect(springPosition(spring, 0)).toBe(0);
      expect(springPosition(spring, 5)).toBeCloseTo(1, 4);
    }
  });

  it("overshoots slightly when under-damped, so it reads as physical", () => {
    const peak = Math.max(
      ...Array.from({ length: 200 }, (_, i) =>
        springPosition(SPRINGS.unfold, i / 200),
      ),
    );
    expect(peak).toBeGreaterThan(1);
    // A single soft settle, not a wobble.
    expect(peak).toBeLessThan(1.05);
  });

  it("never overshoots once critically or over-damped", () => {
    for (const damping of [1, 1.4]) {
      const spring = { response: 0.4, damping };
      let last = 0;
      for (let i = 1; i <= 200; i += 1) {
        const value = springPosition(spring, i / 100);
        expect(value).toBeLessThanOrEqual(1 + 1e-9);
        expect(value).toBeGreaterThanOrEqual(last - 1e-9);
        last = value;
      }
    }
  });

  it("settles within the epsilon by its settle time", () => {
    for (const spring of Object.values(SPRINGS)) {
      const settle = springSettleSeconds(spring);
      expect(settle).toBeGreaterThan(spring.response / 2);
      expect(settle).toBeLessThan(spring.response * 4);
      expect(Math.abs(1 - springPosition(spring, settle))).toBeLessThan(0.002);
    }
  });
});

describe("springEasing", () => {
  it("hands CSS an evenly sampled linear() curve from 0 to 1", () => {
    const easing = springEasing(SPRINGS.unfold, 10);
    expect(easing.startsWith("linear(0, ")).toBe(true);
    expect(easing.endsWith(", 1)")).toBe(true);
    expect(easing.split(",").length).toBe(11);
    expect(easing).not.toContain("NaN");
  });

  it("caches the transition per spring", () => {
    expect(springTransition(SPRINGS.glide)).toBe(
      springTransition(SPRINGS.glide),
    );
    expect(springTransition(SPRINGS.glide).durationMs).toBeGreaterThan(0);
  });
});

describe("stepSpring", () => {
  it("reaches the target and reports itself settled", () => {
    const state = { value: 0, velocity: 0 };
    for (let i = 0; i < 300; i += 1) {
      stepSpring(SPRINGS.unfold, state, 100, 1 / 60);
    }
    expect(state.value).toBeCloseTo(100, 2);
    expect(springSettled(state, 100, 100)).toBe(true);
  });

  it("keeps its momentum when the target moves mid-flight", () => {
    const state = { value: 0, velocity: 0 };
    for (let i = 0; i < 6; i += 1) {
      stepSpring(SPRINGS.unfold, state, 1, 1 / 60);
    }
    const speed = state.velocity;
    expect(speed).toBeGreaterThan(0);
    // Sent back to where it started, it is still moving forward for a moment
    // — that is the difference between a spring and a restarted transition.
    stepSpring(SPRINGS.unfold, state, 0, 1 / 240);
    expect(state.velocity).toBeGreaterThan(0);
    expect(state.velocity).toBeLessThan(speed);
  });

  it("is stable at long frame gaps", () => {
    const state = { value: 0, velocity: 0 };
    stepSpring(SPRINGS.press, state, 1, 0.5);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(state.value).toBeCloseTo(1, 1);
  });
});
