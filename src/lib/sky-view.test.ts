import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sunPosition } from "./sky-ephemeris.ts";
import {
  aimYaw,
  cameraBasis,
  projectDisk,
  projectSky,
  skyCamera,
  worldDirection,
} from "./sky-view.ts";

const vienna = [48.2082, 16.3738] as const;
const limbDip = Math.acos(6_371_000 / 6_471_000);
const laptop = {
  card: { bottom: 640, left: 520, right: 920, top: 180 },
  height: 900,
  width: 1440,
};
const phone = {
  card: { bottom: 700, left: 20, right: 370, top: 120 },
  height: 844,
  width: 390,
};

const close = (a: number, b: number, within: number): boolean =>
  Math.abs(a - b) <= within;

describe("camera", () => {
  it("puts the zenith at the top of a phone and keeps wide screens near it", () => {
    assert.equal(skyCamera(390, 844).top, 1);
    assert.ok(skyCamera(1440, 900).top > 0.9);
    assert.ok(skyCamera(2560, 1080).top < 0.8);
  });

  it("rolls the view around the line of sight and keeps it a rotation", () => {
    const flat = cameraBasis(0.4, 0.1);
    const rolled = cameraBasis(0.4, 0.1, 0.08);
    assert.deepEqual(rolled.slice(6), flat.slice(6));
    for (const index of [0, 1, 2]) {
      const [x = 0, y = 0, z = 0] = rolled.slice(index * 3, index * 3 + 3);
      assert.ok(close(Math.hypot(x, y, z), 1, 1e-9));
    }
    const camera = skyCamera(1440, 900);
    const west = projectSky(worldDirection(0, -20), rolled, camera, 1440, 900);
    const east = projectSky(worldDirection(0, 20), rolled, camera, 1440, 900);
    assert.ok(west && east && Math.abs(west[1] - east[1]) > 5);
  });

  it("keeps the horizon straight and puts the limb 16% above the bottom", () => {
    const camera = skyCamera(1440, 900);
    const basis = cameraBasis(1.2, 0);
    const yawDegrees = 1.2 / (Math.PI / 180);
    for (const azimuth of [-60, -20, 0, 30, 70]) {
      const point = projectSky(
        worldDirection(0, yawDegrees + azimuth),
        basis,
        camera,
        1440,
        900
      );
      assert.ok(point);
      assert.ok(close(point[1], 900 * (1 - camera.horizon), 1e-6));
    }
    const limb = projectSky(
      worldDirection(-limbDip / (Math.PI / 180), yawDegrees),
      basis,
      camera,
      1440,
      900
    );
    assert.ok(limb);
    assert.ok(close(limb[1], 900 * 0.84, 1e-6));
    assert.ok(camera.horizon > 0.16);
  });

  it("projects a disk with its center and a radius that grows off axis", () => {
    const camera = skyCamera(1440, 900);
    const basis = cameraBasis(0, 0);
    const ahead = projectDisk(
      worldDirection(20, 0),
      0.01,
      basis,
      camera,
      1440,
      900
    );
    const aside = projectDisk(
      worldDirection(20, 50),
      0.01,
      basis,
      camera,
      1440,
      900
    );
    assert.ok(ahead && aside);
    assert.deepEqual(
      ahead.slice(0, 2),
      projectSky(worldDirection(20, 0), basis, camera, 1440, 900)
    );
    assert.ok(aside[2] > ahead[2]);
  });
});

describe("aim", () => {
  it("frames the noon sun beside the card at its true height", () => {
    const sun = sunPosition(Date.parse("2026-06-21T11:00:00Z"), ...vienna);
    const point = projectSky(
      worldDirection(sun.altitude, sun.azimuth),
      cameraBasis(aimYaw(sun, laptop), 0),
      skyCamera(laptop.width, laptop.height),
      laptop.width,
      laptop.height
    );
    assert.ok(point);
    assert.ok(point[0] > laptop.card.right && point[0] < laptop.width);
    assert.ok(point[1] > 0 && point[1] < laptop.card.bottom);
  });

  it("puts a low sun in the middle of the free side", () => {
    const sun = sunPosition(Date.parse("2026-10-14T06:30:00Z"), ...vienna);
    const point = projectSky(
      worldDirection(sun.altitude, sun.azimuth),
      cameraBasis(aimYaw(sun, laptop), 0),
      skyCamera(laptop.width, laptop.height),
      laptop.width,
      laptop.height
    );
    assert.ok(point);
    assert.ok(close(point[0], (laptop.card.right + laptop.width) / 2, 0.5));
  });

  it("keeps a phone sun on the screen", () => {
    const sun = sunPosition(Date.parse("2026-10-14T10:00:00Z"), ...vienna);
    const point = projectSky(
      worldDirection(sun.altitude, sun.azimuth),
      cameraBasis(aimYaw(sun, phone), 0),
      skyCamera(phone.width, phone.height),
      phone.width,
      phone.height
    );
    assert.ok(point);
    assert.ok(point[0] > 0 && point[0] < phone.width);
    assert.ok(point[1] > 0 && point[1] < phone.height);
  });
});
