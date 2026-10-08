import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLogoMotion,
  type LogoInput,
  type LogoMotion,
  logoMotionConfig,
  logoSpin,
  settleLogoMotion,
  stepLogoMotion,
} from "./logo-motion.ts";

const frameMs = 33;
const seen: LogoInput = { hotGoal: 0, started: true };
const unseen: LogoInput = { hotGoal: 0, started: false };
const hover: LogoInput = { hotGoal: 1, started: true };

const run = (totalMs: number, dtMs: number, input: LogoInput): LogoMotion => {
  let state = createLogoMotion();
  for (let time = 0; time < totalMs; time += dtMs) {
    state = stepLogoMotion(state, dtMs, input);
  }
  return state;
};

const lcg = (seed: number): (() => number) => {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
};

const near = (actual: number, expected: number, tolerance: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${String(actual)} is not within ${String(tolerance)} of ${String(expected)}`
  );
};

describe("logo motion", () => {
  it("keeps the spec numbers", () => {
    assert.deepEqual(logoMotionConfig, {
      hotAmplitude: 0.5,
      hotSpeed: 3.4,
      hotTauMs: 140,
      sunriseFrom: -1.9,
      sunriseMs: 2400,
      wobbleAmplitude: 0.35,
      wobblePeriodMs: 9000,
    });
  });

  it("starts on the night side", () => {
    assert.equal(logoSpin(createLogoMotion()), -1.9);
  });

  it("stays on the night side until it is seen", () => {
    assert.equal(logoSpin(run(1000, frameMs, unseen)), -1.9);
  });

  it("turns in by at most 0.15 rad per 33 ms frame", () => {
    let state = createLogoMotion();
    let spin = logoSpin(state);
    for (let time = 0; time < 2900; time += frameMs) {
      state = stepLogoMotion(state, frameMs, seen);
      const next = logoSpin(state);
      assert.ok(
        Math.abs(next - spin) <= 0.15,
        `${String(spin)} to ${String(next)}`
      );
      spin = next;
    }
  });

  it("follows the ease-out cubic halfway through the sunrise", () => {
    near(logoSpin(run(1200, 100, seen)), -0.2375, 1e-9);
  });

  it("rests at exactly 0 rad when the sunrise ends", () => {
    assert.equal(logoSpin(run(2400, 100, seen)), 0);
  });

  it("finishes the sunrise after it leaves the view", () => {
    const begun = stepLogoMotion(createLogoMotion(), 1000, seen);
    const state = stepLogoMotion(begun, 2000, unseen);
    assert.equal(state.elapsedMs, 2400);
    near(logoSpin(state), 0.35 * Math.sin((2 * Math.PI * 600) / 9000), 1e-9);
  });

  it("swings to 0.35 rad a quarter period after the sunrise", () => {
    const state = stepLogoMotion(run(2400, 100, seen), 2250, seen);
    near(logoSpin(state), 0.35, 1e-6);
  });

  it("swings 3.4 times as fast and up to 0.5 rad while hovered", () => {
    const glowing = settleLogoMotion(run(5000, 100, hover));
    const state = stepLogoMotion(glowing, 9000 / 3.4 / 4, hover);
    near(logoSpin(state), 0.5, 1e-3);
  });

  it("wobbles within 0.5 rad after the sunrise, hovered or not", () => {
    const random = lcg(7);
    let state = run(2400, 100, seen);
    for (let index = 0; index < 2000; index += 1) {
      const input = { hotGoal: random() < 0.5 ? 0 : 1, started: true };
      state = stepLogoMotion(state, random() * 100, input);
      const spin = logoSpin(state);
      assert.ok(Math.abs(spin) <= 0.5 + 1e-12, String(spin));
    }
  });

  it("settles to the rest pose", () => {
    const fresh = settleLogoMotion(createLogoMotion());
    const midway = settleLogoMotion(run(1200, frameMs, seen));
    assert.equal(logoSpin(fresh), 0);
    assert.equal(logoSpin(midway), 0);
  });

  it("changes nothing without time", () => {
    const fresh = createLogoMotion();
    assert.deepEqual(stepLogoMotion(fresh, 0, hover), fresh);
    const midway = run(1200, frameMs, seen);
    assert.deepEqual(stepLogoMotion(midway, 0, hover), midway);
  });

  it("ignores a time step that is not a finite number", () => {
    const midway = run(1200, frameMs, seen);
    for (const dtMs of [NaN, Infinity]) {
      assert.deepEqual(stepLogoMotion(midway, dtMs, hover), midway);
    }
  });

  it("eases the hover glow in within a second", () => {
    const { hot } = run(1000, 100, { hotGoal: 1, started: false });
    assert.ok(hot > 0.99, String(hot));
  });
});
