import { describe, it, expect } from "vitest";
import { createStepper, normalizeConfig, percentToDb, formatLevel, DEFAULTS, STICK_MS } from "../src/core.js";

function stepper({ max = 200, step = 5 } = {}) {
  let t = 0;
  const step_ = createStepper({ getMax: () => max, getStep: () => step, now: () => t });
  return {
    step: step_,
    advance(ms) {
      t += ms;
    },
  };
}

describe("createStepper", () => {
  it("steps up and down by the step size", () => {
    const s = stepper();
    expect(s.step(100, 1)).toBe(105);
    expect(s.step(105, -1)).toBe(100);
    expect(s.step(50, -1)).toBe(45);
  });

  it("clamps at max and at 0", () => {
    const s = stepper({ max: 150 });
    expect(s.step(148, 1)).toBe(150);
    expect(s.step(150, 1)).toBe(150);
    expect(s.step(3, -1)).toBe(0);
  });

  it("lands on 100 instead of crossing it, in both directions", () => {
    const s = stepper();
    expect(s.step(98, 1)).toBe(100);
    s.advance(1000);
    expect(s.step(103, -1)).toBe(100);
  });

  it("holds at 100 while input keeps coming, then moves on after a pause", () => {
    const s = stepper();
    let level = 90;
    for (let i = 0; i < 10; i++) {
      level = s.step(level, 1); // auto-repeat every 30 ms
      s.advance(30);
    }
    expect(level).toBe(100);
    s.advance(STICK_MS);
    expect(s.step(level, 1)).toBe(105);
  });

  it("holds going down from boost too", () => {
    const s = stepper();
    let level = 110;
    for (let i = 0; i < 6; i++) {
      level = s.step(level, -1);
      s.advance(50);
    }
    expect(level).toBe(100);
    s.advance(STICK_MS);
    expect(s.step(level, -1)).toBe(95);
  });

  it("does not hold when changing direction at 100", () => {
    const s = stepper();
    expect(s.step(95, 1)).toBe(100);
    expect(s.step(100, -1)).toBe(95);
  });

  it("leaves 100 immediately when it did not arrive there by stepping", () => {
    const s = stepper();
    expect(s.step(100, 1)).toBe(105);
  });
});

describe("normalizeConfig", () => {
  it("returns defaults for empty or invalid input", () => {
    expect(normalizeConfig()).toEqual({ ...DEFAULTS });
    expect(normalizeConfig(null)).toEqual({ ...DEFAULTS });
    expect(normalizeConfig("nope")).toEqual({ ...DEFAULTS });
  });

  it("limits maxPercent to [100, hardMax]", () => {
    expect(normalizeConfig({ maxPercent: 500 }).maxPercent).toBe(200);
    expect(normalizeConfig({ maxPercent: 50 }).maxPercent).toBe(100);
    expect(normalizeConfig({ maxPercent: "175" }).maxPercent).toBe(175);
  });

  it("rejects out-of-range steps and keeps valid keys", () => {
    expect(normalizeConfig({ stepPercent: 0 }).stepPercent).toBe(DEFAULTS.stepPercent);
    expect(normalizeConfig({ stepPercent: 100 }).stepPercent).toBe(DEFAULTS.stepPercent);
    expect(normalizeConfig({ stepPercent: 2 }).stepPercent).toBe(2);
    expect(normalizeConfig({ increaseKey: "+", resetKey: "" }).increaseKey).toBe("+");
    expect(normalizeConfig({ resetKey: "" }).resetKey).toBe(DEFAULTS.resetKey);
  });
});

describe("percentToDb / formatLevel", () => {
  it("uses mpv's cubic curve", () => {
    expect(percentToDb(100)).toBeCloseTo(0, 5);
    expect(percentToDb(150)).toBeCloseTo(10.57, 2);
    expect(percentToDb(200)).toBeCloseTo(18.06, 2);
  });

  it("formats levels with dB", () => {
    expect(formatLevel(150)).toBe("Volume 150% (+10.6 dB)");
    expect(formatLevel(100)).toBe("Volume 100% (0.0 dB)");
    expect(formatLevel(0)).toBe("Volume 0%");
  });
});
