import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  instantOverride,
  pathMass,
  phaseFromSun,
  skyLight,
} from "./sky-light.ts";
import { limbDip } from "./sky-view.ts";

const noon = Date.parse("2026-10-13T13:00:00+02:00");
const night = Date.parse("2026-10-25T23:00:00+01:00");

describe("skyLight", () => {
  it("lights the day from the true sun", () => {
    const light = skyLight(noon);
    assert.ok(light.daylight.day > 0.9);
    assert.ok((light.sunDisk[1] ?? 0) > 0);
    assert.ok(light.sun[1] > 0);
    assert.ok(light.sun[2] < 0, "the noon sun is south");
    assert.ok(
      Math.abs(Math.hypot(light.sun[0], light.sun[1], light.sun[2]) - 1) < 1e-9
    );
  });

  it("shows the moon at night and hides the sun", () => {
    const light = skyLight(night);
    assert.equal(light.daylight.day, 0);
    assert.ok(light.moonDisk[0] > 3);
    assert.ok(light.moon[1] > 0);
    assert.equal(light.sunDisk[1], 0);
  });

  it("draws the disks three times larger than true", () => {
    const light = skyLight(noon);
    assert.ok(Math.abs(light.sunDisk[0] - 3 * 0.267 * (Math.PI / 180)) < 2e-4);
  });

  it("does not let the weather touch the sun, as the eye is above the clouds", () => {
    const light = skyLight(noon);
    assert.ok((light.sunDisk[1] ?? 0) > 5);
    assert.ok(light.sunColor[0] > 2 && light.sunColor[1] > 2);
  });

  it("still shows the sun above the limb after it set on the ground", () => {
    const after = Date.parse("2026-10-14T17:00:00Z");
    const light = skyLight(after);
    assert.ok(light.sun[3] < 0 && light.sun[3] > -limbDip);
    assert.ok((light.sunDisk[1] ?? 0) > 0);
    assert.ok(light.sunColor[0] > 2 * light.sunColor[2]);
  });
});

describe("path mass", () => {
  it("is nothing above the horizon and a thick slab at the limb", () => {
    assert.ok(pathMass(0.3) < 1e-4);
    assert.ok(Math.abs(pathMass(-limbDip + 1e-6) - 70.8) < 1);
    assert.ok(pathMass(-limbDip + 0.01) < pathMass(-limbDip + 0.001));
  });

  it("is thin well above the limb", () => {
    assert.ok(pathMass(-0.05) < 0.1);
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
