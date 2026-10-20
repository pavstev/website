import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aimAzimuth,
  anchorX,
  blendAim,
  horizonHeight,
  pixelsPerDegree,
  projectSight,
  turnDegrees,
} from "./sky-view.ts";

const laptop = {
  card: { bottom: 640, left: 520, right: 920, top: 180 },
  height: 900,
  width: 1440,
};

const phone = {
  card: { bottom: 760, left: 16, right: 374, top: 80 },
  height: 844,
  width: 390,
};

describe("painted view", () => {
  it("puts the horizon at 2% and the zenith on the top edge", () => {
    assert.equal(horizonHeight(900), 18);
    assert.ok(Math.abs(pixelsPerDegree(900) - 9.8) < 1e-9);
    const top = projectSight({ altitude: 90, azimuth: 200 }, 200, {
      height: 900,
      width: 1440,
    });
    assert.ok(Math.abs(top.y - 900) < 1e-6);
    assert.equal(top.x, 720);
  });

  it("wraps azimuths across north", () => {
    assert.equal(turnDegrees(190), -170);
    assert.equal(turnDegrees(-190), 170);
    assert.equal(turnDegrees(180), -180);
    const point = projectSight({ altitude: 10, azimuth: 5 }, 355, laptop);
    assert.ok(Math.abs(point.x - (720 + 10 * 9.8)) < 1e-9);
  });

  it("puts the bright body in the free side right of the card", () => {
    assert.equal(anchorX(laptop), (920 + 1440) / 2);
    const center = aimAzimuth({ altitude: 30, azimuth: 200 }, laptop);
    const sun = projectSight({ altitude: 30, azimuth: 200 }, center, laptop);
    assert.ok(Math.abs(sun.x - 1180) < 1e-9);
  });

  it("keeps a phone body near the right edge", () => {
    const x = anchorX(phone);
    assert.ok(x > phone.width - 24 && x < phone.width);
    assert.equal(anchorX({ height: 900, width: 1000 }), 780);
  });

  it("blends the aim the short way round", () => {
    assert.equal(blendAim(350, 10, 0), 350);
    assert.equal(blendAim(350, 10, 1), 370);
    assert.equal(blendAim(350, 10, 0.5), 360);
    assert.equal(blendAim(100, 200, 0.25), 125);
  });
});
