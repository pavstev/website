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

  it("keeps the home view exactly as it was without a horizon", () => {
    for (let height = 320; height <= 2160; height += 7) {
      assert.equal(pixelsPerDegree(height), (0.98 * height) / 90);
      assert.equal(horizonHeight(height), 0.02 * height);
      const view = { height, width: 1000 };
      const point = projectSight({ altitude: 33, azimuth: 120 }, 100, view);
      assert.equal(point.y, 0.02 * height + 33 * ((0.98 * height) / 90));
    }
  });

  it("raises the horizon and keeps the zenith on the top edge", () => {
    assert.equal(horizonHeight(800, 0.11), 88);
    assert.equal(horizonHeight(800), horizonHeight(800, 0.02));
    assert.equal(pixelsPerDegree(800), pixelsPerDegree(800, 0.02));
    const view = { height: 800, horizon: 0.11, width: 1280 };
    const flat = projectSight({ altitude: 0, azimuth: 90 }, 90, view);
    assert.ok(Math.abs(flat.y - 88) < 1e-9);
    const top = projectSight({ altitude: 90, azimuth: 90 }, 90, view);
    assert.ok(Math.abs(top.y - 800) < 1e-9);
    const home = projectSight({ altitude: 30, azimuth: 90 }, 90, {
      height: 800,
      width: 1280,
    });
    const raised = projectSight({ altitude: 30, azimuth: 90 }, 90, view);
    assert.ok(raised.y > home.y);
  });

  it("aims by the raised view scale", () => {
    const sight = { altitude: 20, azimuth: 150 };
    const plain = { height: 900, width: 1000 };
    const raised = { ...plain, horizon: 0.11 };
    const aimed = aimAzimuth(sight, raised);
    const at = projectSight(sight, aimed, raised);
    assert.ok(Math.abs(at.x - anchorX(raised)) < 1e-9);
    assert.notEqual(aimed, aimAzimuth(sight, plain));
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
