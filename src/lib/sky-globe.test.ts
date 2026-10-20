import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blendMotion,
  clampLatitude,
  clampZoom,
  dragCenter,
  fromVector,
  keyMove,
  keyZoom,
  maxLatitude,
  maxZoom,
  minZoom,
  pointUnder,
  shortestTurn,
  stepInertia,
  subsolarPoint,
  toVector,
  wheelZoom,
  wrapLongitude,
} from "./sky-globe.ts";

const near = (actual: number, expected: number, digits = 6): void => {
  assert.ok(
    Math.abs(actual - expected) < 10 ** -digits,
    `${String(actual)} is not near ${String(expected)}`
  );
};

describe("toVector and fromVector", () => {
  it("puts the origin on +z, east on +x and north on +y", () => {
    const origin = toVector({ lat: 0, lon: 0 });
    near(origin.x, 0);
    near(origin.y, 0);
    near(origin.z, 1);
    const east = toVector({ lat: 0, lon: 90 });
    near(east.x, 1);
    near(east.z, 0);
    near(toVector({ lat: 90, lon: 0 }).y, 1);
  });

  it("returns the same point after a round trip", () => {
    for (const spot of [
      { lat: 48.2, lon: 16.4 },
      { lat: -33.9, lon: 151.2 },
      { lat: 0, lon: -179.5 },
      { lat: 71, lon: -120 },
    ]) {
      const back = fromVector(toVector(spot));
      near(back.lat, spot.lat);
      near(back.lon, spot.lon);
    }
  });
});

describe("clamp and wrap", () => {
  it("clamps the latitude to 80 degrees", () => {
    assert.equal(maxLatitude, 80);
    assert.equal(clampLatitude(95), 80);
    assert.equal(clampLatitude(-95), -80);
    assert.equal(clampLatitude(12), 12);
  });

  it("wraps the longitude into -180 to 180", () => {
    assert.equal(wrapLongitude(190), -170);
    assert.equal(wrapLongitude(-190), 170);
    assert.equal(wrapLongitude(540), -180);
    assert.equal(wrapLongitude(45), 45);
  });
});

describe("dragCenter", () => {
  const radius = 100;

  it("turns the surface with the finger: a drag right lowers the longitude", () => {
    const moved = dragCenter({ lat: 0, lon: 0 }, 10, 0, radius, 1);
    near(moved.lon, -((10 / radius) * 180) / Math.PI);
    near(moved.lat, 0);
  });

  it("raises the latitude when the finger moves down", () => {
    const moved = dragCenter({ lat: 0, lon: 0 }, 0, 10, radius, 1);
    near(moved.lat, ((10 / radius) * 180) / Math.PI);
  });

  it("divides the angle by the zoom", () => {
    const one = dragCenter({ lat: 0, lon: 0 }, 20, 0, radius, 1);
    const four = dragCenter({ lat: 0, lon: 0 }, 20, 0, radius, 4);
    near(four.lon, one.lon / 4);
  });

  it("clamps the latitude and wraps the longitude", () => {
    assert.equal(dragCenter({ lat: 79, lon: 0 }, 0, 5000, radius, 1).lat, 80);
    assert.equal(
      dragCenter({ lat: 0, lon: -179 }, 100, 0, radius, 1).lon > 0,
      true
    );
  });

  it("keeps up with the finger near the poles", () => {
    const flat = dragCenter({ lat: 0, lon: 0 }, 10, 0, radius, 1);
    const high = dragCenter({ lat: 60, lon: 0 }, 10, 0, radius, 1);
    near(Math.abs(high.lon), Math.abs(flat.lon) * 2, 4);
  });
});

describe("inertia", () => {
  it("slows down and ends", () => {
    let motion = { lat: 0, lon: 0.2 };
    let total = 0;
    let steps = 0;
    let done = false;
    while (!done && steps < 1000) {
      const step = stepInertia(motion, 16);
      total += step.move.lon;
      ({ done, motion } = step);
      steps += 1;
    }
    assert.equal(done, true);
    assert.ok(steps > 10 && steps < 1000);
    assert.ok(total > 55 && total <= 56);
    assert.ok(steps * 16 < 1300);
  });

  it("moves less each step", () => {
    const first = stepInertia({ lat: 0, lon: 0.2 }, 16);
    const second = stepInertia(first.motion, 16);
    assert.ok(second.move.lon < first.move.lon);
  });

  it("stops at once for a tiny motion", () => {
    const step = stepInertia({ lat: 0, lon: 0.002 }, 16);
    assert.equal(step.done, true);
  });
});

describe("blendMotion", () => {
  it("follows the last move and caps the speed", () => {
    const slow = blendMotion({ lat: 0, lon: 0 }, { lat: 0, lon: 0.16 }, 16);
    assert.ok(slow.lon > 0 && slow.lon <= 0.01);
    const fast = blendMotion({ lat: 0, lon: 0 }, { lat: 90, lon: 90 }, 1);
    assert.ok(Math.hypot(fast.lat, fast.lon) <= 0.5 + 1e-9);
  });

  it("ignores a zero time step", () => {
    const prev = { lat: 0.1, lon: 0.1 };
    assert.deepEqual(blendMotion(prev, { lat: 5, lon: 5 }, 0), prev);
  });
});

describe("zoom", () => {
  it("clamps between 1x and 6x", () => {
    assert.equal(minZoom, 1);
    assert.equal(maxZoom, 6);
    assert.equal(clampZoom(0.2), 1);
    assert.equal(clampZoom(40), 6);
    assert.equal(clampZoom(3), 3);
  });

  it("zooms in on a wheel up and out on a wheel down", () => {
    assert.ok(wheelZoom(2, -100) > 2);
    assert.ok(wheelZoom(2, 100) < 2);
    assert.equal(wheelZoom(1, 1000), 1);
    assert.equal(wheelZoom(6, -1000), 6);
  });
});

describe("keys", () => {
  it("moves one degree, or ten with Shift", () => {
    assert.deepEqual(keyMove("ArrowUp", false), { lat: 1, lon: 0 });
    assert.deepEqual(keyMove("ArrowDown", false), { lat: -1, lon: 0 });
    assert.deepEqual(keyMove("ArrowLeft", false), { lat: 0, lon: -1 });
    assert.deepEqual(keyMove("ArrowRight", true), { lat: 0, lon: 10 });
    assert.equal(keyMove("a", false), undefined);
  });

  it("zooms with plus and minus", () => {
    const zoomIn = keyZoom("+");
    const zoomOut = keyZoom("-");
    assert.ok(zoomIn !== undefined && zoomIn > 1);
    assert.ok(zoomOut !== undefined && zoomOut < 1);
    assert.equal(keyZoom("="), zoomIn);
    assert.equal(keyZoom("x"), undefined);
  });
});

describe("pointUnder", () => {
  it("gives the center for the middle of the box", () => {
    const spot = pointUnder({ lat: 48.2, lon: 16.4 }, { x: 0, y: 0 }, 100);
    assert.ok(spot);
    near(spot.lat, 48.2);
    near(spot.lon, 16.4);
  });

  it("reads the side of the sphere", () => {
    const east = pointUnder({ lat: 0, lon: 10 }, { x: 100, y: 0 }, 100);
    assert.ok(east);
    near(east.lon, 100);
    const north = pointUnder({ lat: 0, lon: 0 }, { x: 0, y: 100 }, 100);
    assert.ok(north);
    near(north.lat, 90);
  });

  it("gives nothing outside the sphere", () => {
    assert.equal(
      pointUnder({ lat: 0, lon: 0 }, { x: 101, y: 0 }, 100),
      undefined
    );
  });
});

describe("shortestTurn", () => {
  it("goes the short way over the date line", () => {
    const turn = shortestTurn({ lat: 10, lon: 170 }, { lat: 20, lon: -170 });
    assert.deepEqual(turn, { lat: 10, lon: 20 });
  });
});

describe("subsolarPoint", () => {
  it("sits near the equator at the March equinox noon UTC", () => {
    const spot = subsolarPoint(Date.UTC(2026, 2, 20, 12, 0, 0));
    assert.ok(Math.abs(spot.lat) < 1.5);
    assert.ok(Math.abs(spot.lon) < 6);
  });

  it("reaches the tropic at the June solstice", () => {
    const spot = subsolarPoint(Date.UTC(2026, 5, 21, 12, 0, 0));
    assert.ok(spot.lat > 23 && spot.lat < 23.6);
  });

  it("follows the equation of time in sign", () => {
    const feb = subsolarPoint(Date.UTC(2026, 1, 11, 12, 0, 0));
    const nov = subsolarPoint(Date.UTC(2026, 10, 3, 12, 0, 0));
    assert.ok(Math.abs(feb.lon - 3.55) < 0.3, String(feb.lon));
    assert.ok(Math.abs(nov.lon + 4.1) < 0.3, String(nov.lon));
  });

  it("moves the sun 15 degrees west every hour", () => {
    const before = subsolarPoint(Date.UTC(2026, 9, 8, 9, 0, 0));
    const after = subsolarPoint(Date.UTC(2026, 9, 8, 10, 0, 0));
    assert.ok(Math.abs(before.lon - after.lon - 15) < 0.05);
  });
});
