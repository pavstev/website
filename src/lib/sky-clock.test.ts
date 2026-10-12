import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { phaseAt, skyPhase, sunTimes } from "./sky-clock.ts";

const close = (actual: number, expected: number, within: number): void => {
  assert.ok(Math.abs(actual - expected) <= within);
};

describe("sunTimes", () => {
  it("gives about 12 hours of day at the equinox", () => {
    const sun = sunTimes(80, 47, 12);
    close(sun.set - sun.rise, 12.1, 0.2);
  });

  it("gives long summer days and short winter days at 47 degrees", () => {
    const june = sunTimes(172, 47, 12);
    const december = sunTimes(355, 47, 12);
    close(june.set - june.rise, 15.8, 0.3);
    close(december.set - december.rise, 8.6, 0.3);
  });

  it("centres the day on the given noon", () => {
    const sun = sunTimes(200, 47, 13);
    close((sun.rise + sun.set) / 2, 13, 1e-9);
  });
});

describe("phaseAt", () => {
  const sun = { rise: 7, set: 19 };

  it("is night at midnight", () => {
    const phase = phaseAt(0, sun, 1.1);
    assert.equal(phase.day, 0);
    assert.equal(phase.dusk, 0);
    close(phase.twilight, 0, 1e-9);
  });

  it("is full day at noon", () => {
    const phase = phaseAt(13, sun, 1.1);
    close(phase.day, 1, 1e-9);
    close(phase.twilight, 0, 1e-6);
  });

  it("glows at sunrise and sunset and tells them apart", () => {
    const dawn = phaseAt(7, sun, 1.1);
    const dusk = phaseAt(19, sun, 1.1);
    close(dawn.twilight, 1, 1e-9);
    close(dusk.twilight, 1, 1e-9);
    assert.equal(dawn.dusk, 0);
    assert.equal(dusk.dusk, 1);
    assert.ok(dawn.day > 0 && dawn.day < 0.5);
  });

  it("stays between 0 and 1 for every minute of the day", () => {
    for (let minute = 0; minute < 1440; minute += 1) {
      const phase = phaseAt(minute / 60, sun, 1.1);
      for (const value of [phase.day, phase.twilight, phase.dusk]) {
        assert.ok(value >= 0 && value <= 1);
      }
    }
  });
});

describe("skyPhase", () => {
  it("reads the local clock", () => {
    const night = skyPhase(new Date(2026, 9, 12, 2, 0));
    const noon = skyPhase(new Date(2026, 9, 12, 13, 0));
    assert.equal(night.day, 0);
    assert.ok(noon.day > 0.9);
  });
});
