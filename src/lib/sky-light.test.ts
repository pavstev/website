import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  desktopHorizon,
  horizonShare,
  instantOverride,
  phaseFromSun,
  phoneHorizon,
  skyLight,
  viewDirection,
} from "./sky-light.ts";
import { weatherPresets } from "./weather.ts";

const view = { height: 900, width: 1440 };
const noon = Date.parse("2026-10-13T13:00:00+02:00");
const night = Date.parse("2026-10-25T23:00:00+01:00");

describe("skyLight", () => {
  it("lights the day from a visible sun", () => {
    const light = skyLight(noon, weatherPresets.clear, view);
    assert.ok(light.daylight.day > 0.9);
    assert.ok((light.sunDisk[1] ?? 0) > 0);
    assert.ok(light.shownSun[1] > 0);
    assert.ok(light.nightOn < 0.05);
  });

  it("keeps the true sun for the buildings", () => {
    const light = skyLight(noon, weatherPresets.clear, view);
    assert.ok(
      light.trueSun[2] < 0,
      "the noon sun is south, behind a north view"
    );
    assert.ok(Math.abs(Math.hypot(...light.trueSun) - 1) < 1e-9);
  });

  it("shows the full moon at night and turns the city lights on", () => {
    const light = skyLight(night, weatherPresets.clear, view);
    assert.equal(light.daylight.day, 0);
    assert.ok(light.moonDisk[0] > 3);
    assert.ok(light.moon[1] > 0);
    assert.equal(light.nightOn, 1);
    assert.equal(light.sunDisk[1], 0);
  });

  it("hides the disks under a full overcast", () => {
    const light = skyLight(noon, weatherPresets.overcast, view);
    assert.ok((light.sunDisk[1] ?? 1) < 0.5);
    assert.ok(light.sunColor[0] < 1);
  });
});

describe("helpers", () => {
  it("gives phones a lower horizon", () => {
    assert.equal(horizonShare(390, 844), phoneHorizon);
    assert.equal(horizonShare(1440, 900), desktopHorizon);
  });

  it("names the evening as dusk", () => {
    assert.equal(phaseFromSun(10, 200).dusk, 1);
    assert.equal(phaseFromSun(10, 120).dusk, 0);
    assert.equal(phaseFromSun(-20, 0).day, 0);
  });

  it("points north straight ahead", () => {
    const [x, y, z] = viewDirection(0, 352);
    assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && z > 0.999);
  });

  it("reads ?at= and ignores junk", () => {
    assert.equal(instantOverride("?at=2026-10-13T13:00:00%2B02:00"), noon);
    assert.equal(instantOverride("?at=soon"), undefined);
    assert.equal(instantOverride(""), undefined);
  });
});
