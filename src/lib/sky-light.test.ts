import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { instantOverride, phaseFromSun, skyLight } from "./sky-light.ts";
import { weatherPresets } from "./weather.ts";

const noon = Date.parse("2026-10-13T13:00:00+02:00");
const night = Date.parse("2026-10-25T23:00:00+01:00");

describe("skyLight", () => {
  it("lights the day from the true sun", () => {
    const light = skyLight(noon, weatherPresets.clear);
    assert.ok(light.daylight.day > 0.9);
    assert.ok((light.sunDisk[1] ?? 0) > 0);
    assert.ok(light.sun[1] > 0);
    assert.ok(light.sun[2] < 0, "the noon sun is south");
    assert.ok(
      Math.abs(Math.hypot(light.sun[0], light.sun[1], light.sun[2]) - 1) < 1e-9
    );
  });

  it("shows the moon at night and hides the sun", () => {
    const light = skyLight(night, weatherPresets.clear);
    assert.equal(light.daylight.day, 0);
    assert.ok(light.moonDisk[0] > 3);
    assert.ok(light.moon[1] > 0);
    assert.equal(light.sunDisk[1], 0);
  });

  it("draws the disks three times larger than true", () => {
    const light = skyLight(noon, weatherPresets.clear);
    assert.ok(Math.abs(light.sunDisk[0] - 3 * 0.267 * (Math.PI / 180)) < 2e-4);
  });

  it("keeps a watery sun under a full overcast", () => {
    const clear = skyLight(noon, weatherPresets.clear);
    const grey = skyLight(noon, weatherPresets.overcast);
    assert.ok((grey.sunDisk[1] ?? 0) > 0.2 * (clear.sunDisk[1] ?? 0));
    assert.ok((grey.sunDisk[1] ?? 1) < 0.5 * (clear.sunDisk[1] ?? 0));
    assert.ok(grey.sunColor[0] < 1);
  });
});

describe("helpers", () => {
  it("names the evening as dusk", () => {
    assert.equal(phaseFromSun(10, 200).dusk, 1);
    assert.equal(phaseFromSun(10, 120).dusk, 0);
    assert.equal(phaseFromSun(-20, 0).day, 0);
  });

  it("reads ?at= and ignores junk", () => {
    assert.equal(instantOverride("?at=2026-10-13T13:00:00%2B02:00"), noon);
    assert.equal(instantOverride("?at=soon"), undefined);
    assert.equal(instantOverride(""), undefined);
  });
});
