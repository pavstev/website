import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sunPosition } from "./sky-ephemeris.ts";
import {
  aimHolds,
  aimYaw,
  cameraBasis,
  diskGain,
  frameAim,
  limbDip,
  projectSky,
  skyCamera,
  skyRay,
  worldDirection,
} from "./sky-view.ts";

const vienna = [48.2082, 16.3738] as const;
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

  it("looks down from 100 km: the limb sits about ten degrees below the horizon", () => {
    assert.ok(close(limbDip / (Math.PI / 180), 10.1, 0.1));
    assert.equal(skyCamera(1440, 900).eye, 100_000);
  });

  it("turns a pixel into a ray and back", () => {
    const camera = skyCamera(1440, 900);
    const basis = cameraBasis(2.1, 0.01);
    for (const [x, y] of [
      [100, 50],
      [720, 400],
      [1300, 860],
    ] as const) {
      const ray = skyRay(x, y, basis, camera, 1440, 900);
      assert.ok(close(Math.hypot(...ray), 1, 1e-9));
      const back = projectSky(ray, basis, camera, 1440, 900);
      assert.ok(back);
      assert.ok(close(back[0], x, 1e-6) && close(back[1], y, 1e-6));
    }
  });
});

describe("aim", () => {
  it("frames the noon sun beside the card at its true height", () => {
    const noon = Date.parse("2026-06-21T11:00:00Z");
    const aim = frameAim(noon, ...vienna);
    assert.equal(aim.kind, "sun");
    const yaw = aimYaw(aim, laptop);
    const camera = skyCamera(laptop.width, laptop.height);
    const point = projectSky(
      worldDirection(aim.target.altitude, aim.target.azimuth),
      cameraBasis(yaw, 0),
      camera,
      laptop.width,
      laptop.height
    );
    assert.ok(point);
    assert.ok(point[0] > laptop.card.right && point[0] < laptop.width);
    assert.ok(point[1] > 0 && point[1] < laptop.card.bottom);
    assert.ok(aimHolds(yaw, aim, laptop));
  });

  it("puts a low sun in the middle of the free side", () => {
    const morning = Date.parse("2026-10-14T06:30:00Z");
    const aim = frameAim(morning, ...vienna);
    const point = projectSky(
      worldDirection(aim.target.altitude, aim.target.azimuth),
      cameraBasis(aimYaw(aim, laptop), 0),
      skyCamera(laptop.width, laptop.height),
      laptop.width,
      laptop.height
    );
    assert.ok(point);
    assert.ok(close(point[0], (laptop.card.right + laptop.width) / 2, 0.5));
  });

  it("frames the moon at night and faces the dusk glow", () => {
    const fullMoon = Date.parse("2026-12-21T20:00:00Z");
    assert.equal(frameAim(fullMoon, ...vienna).kind, "moon");
    const dusk = Date.parse("2026-10-10T17:40:00Z");
    const aim = frameAim(dusk, ...vienna);
    assert.equal(aim.kind, "twilight");
    const sun = sunPosition(dusk, ...vienna);
    assert.ok(close(aim.target.azimuth, sun.azimuth, 1e-9));
  });

  it("looks where the next body rises on a dark night", () => {
    const dark = Date.parse("2026-01-20T22:00:00Z");
    const aim = frameAim(dark, ...vienna);
    assert.equal(aim.kind, "rise");
    assert.ok(aim.target.azimuth > 30 && aim.target.azimuth < 150);
  });

  it("keeps a phone aim on the screen", () => {
    const aim = frameAim(Date.parse("2026-10-14T10:00:00Z"), ...vienna);
    const yaw = aimYaw(aim, phone);
    assert.ok(aimHolds(yaw, aim, phone));
  });

  it("re-aims once the body leaves the frame", () => {
    const aim = frameAim(Date.parse("2026-10-14T10:00:00Z"), ...vienna);
    const yaw = aimYaw(aim, laptop);
    assert.equal(aimHolds(yaw + Math.PI, aim, laptop), false);
  });
});

describe("disk gain", () => {
  it("draws the disks three times larger apart and true size in an eclipse", () => {
    const sun = worldDirection(30, 180);
    const radius = 0.0045;
    assert.equal(diskGain(sun, worldDirection(10, 120), radius, radius), 3);
    assert.equal(diskGain(sun, worldDirection(30.2, 180), radius, radius), 1);
    const near = diskGain(sun, worldDirection(31, 180), radius, radius);
    assert.ok(near > 1 && near < 3);
  });
});
