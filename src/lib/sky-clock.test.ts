import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nightPhase,
  phaseAt,
  phaseFromName,
  skyPhase,
  skyPhaseNames,
  sunTimes,
} from "./sky-clock.ts";

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
  it("reads the Vienna clock in summer", () => {
    const night = skyPhase(new Date("2026-07-01T00:00:00Z"));
    const noon = skyPhase(new Date("2026-07-01T11:00:00Z"));
    assert.equal(night.day, 0);
    assert.ok(noon.day > 0.9);
  });

  it("reads the Vienna clock in winter", () => {
    const night = skyPhase(new Date("2026-01-15T22:00:00Z"));
    const noon = skyPhase(new Date("2026-01-15T11:00:00Z"));
    assert.equal(night.day, 0);
    assert.ok(noon.day > 0.9);
  });

  it("ends the October day around the Vienna sunset", () => {
    const before = skyPhase(new Date("2026-10-12T15:00:00Z"));
    const after = skyPhase(new Date("2026-10-12T17:30:00Z"));
    assert.ok(before.day > 0.5);
    assert.equal(after.day, 0);
  });
});

describe("phaseFromName", () => {
  const october = sunTimes(286, 48.21, 13);
  const viennaSummerOffset = 2;
  const viennaAt = (hour: number): Date =>
    new Date(Date.UTC(2026, 9, 13) + (hour - viennaSummerOffset) * 3_600_000);
  const twentyMinutes = 20 / 60;

  it("names the four phases", () => {
    assert.deepEqual(skyPhaseNames, ["night", "dawn", "day", "dusk"]);
  });

  it("gives the night phase for night", () => {
    assert.deepEqual(phaseFromName("night"), nightPhase);
  });

  it("gives full daylight for day", () => {
    const day = phaseFromName("day");
    assert.equal(day.day, 1);
    assert.equal(day.twilight, 0);
    assert.equal(day.dusk, 0);
  });

  it("puts the October Vienna sun where the sky clock expects it", () => {
    assert.ok(october.rise > 7.3 && october.rise < 7.8);
    assert.ok(october.set > 18.2 && october.set < 18.7);
  });

  it("matches the Vienna sky 20 minutes after sunrise on 2026-10-13", () => {
    const dawn = phaseFromName("dawn");
    const live = skyPhase(viennaAt(october.rise + twentyMinutes));
    close(dawn.day, live.day, 1e-3);
    close(dawn.twilight, live.twilight, 1e-3);
    assert.equal(dawn.dusk, 0);
    assert.equal(live.dusk, 0);
    assert.ok(dawn.twilight > 0.5);
  });

  it("matches the Vienna sky 20 minutes after sunset on 2026-10-13", () => {
    const dusk = phaseFromName("dusk");
    const live = skyPhase(viennaAt(october.set + twentyMinutes));
    close(dusk.day, live.day, 1e-3);
    close(dusk.twilight, live.twilight, 1e-3);
    assert.equal(dusk.dusk, 1);
    assert.equal(live.dusk, 1);
    assert.ok(dusk.twilight > 0.5);
  });

  it("returns a fresh object each time", () => {
    const first = phaseFromName("dusk");
    first.day = 9;
    assert.notEqual(phaseFromName("dusk").day, 9);
  });
});
