import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  moonIllumination,
  moonPosition,
  moonRiseSet,
  sunPosition,
  sunRiseSet,
} from "./sky-ephemeris.ts";

const latitude = 48.2082;
const longitude = 16.3738;
const minute = 60_000;
const deg = Math.PI / 180;

const close = (actual: number, expected: number, within: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${String(actual)} is not within ${String(within)} of ${String(expected)}`
  );
};

const utc = (text: string): number => Date.parse(`${text}Z`);

const clockMs = (day: string, time: string): number => utc(`${day}T${time}:00`);

describe("sunPosition against JPL Horizons (apparent, refracted)", () => {
  const cases: ReadonlyArray<readonly [string, number, number]> = [
    ["2026-03-20T09:00", 141.743499, 34.982522],
    ["2026-06-21T10:00", 150.749855, 62.835172],
    ["2026-06-21T17:30", 291.911752, 12.029526],
    ["2026-10-13T12:00", 203.124579, 31.276775],
    ["2026-12-21T11:00", 181.800108, 18.383238],
    ["2026-12-21T14:30", 228.317227, 3.63967],
  ];
  for (const [when, azimuth, altitude] of cases) {
    it(`matches at ${when} UTC`, () => {
      const sun = sunPosition(utc(when), latitude, longitude);
      close(sun.azimuth, azimuth, 0.05);
      close(sun.altitude, altitude, 0.05);
    });
  }

  it("takes a Date as well as epoch milliseconds", () => {
    const fromDate = sunPosition(
      new Date(utc("2026-12-21T11:00")),
      latitude,
      longitude
    );
    const fromMs = sunPosition(utc("2026-12-21T11:00"), latitude, longitude);
    assert.deepEqual(fromDate, fromMs);
  });

  it("gives the sun about 0.53 degrees across", () => {
    const sun = sunPosition(utc("2026-06-21T10:00"), latitude, longitude);
    close(sun.angularRadius * 2, 0.5245, 0.002);
  });
});

describe("sunRiseSet against USNO for Vienna", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["2026-03-20", "04:58", "17:07"],
    ["2026-06-21", "02:54", "18:59"],
    ["2026-12-21", "06:42", "15:03"],
  ];
  for (const [day, rise, set] of cases) {
    it(`matches on ${day}`, () => {
      const times = sunRiseSet(utc(`${day}T00:00`), latitude, longitude);
      close(times.rise ?? 0, clockMs(day, rise), 1.5 * minute);
      close(times.set ?? 0, clockMs(day, set), 1.5 * minute);
    });
  }
});

describe("moonPosition against JPL Horizons (topocentric, refracted)", () => {
  const cases: ReadonlyArray<
    readonly [string, number, number, number, number]
  > = [
    ["2026-06-21T20:00", 234.734541, 24.128042, 0.0025759333, 0.491738],
    ["2026-10-13T16:30", 227.774708, 2.341071, 0.0026641756, 0.0931809],
    ["2026-10-18T14:00", 140.861563, 7.236439, 0.0026880989, 0.4949306],
    ["2026-10-25T22:00", 171.673711, 56.308528, 0.002436359, 0.9978677],
  ];
  for (const [when, azimuth, altitude, distanceAu, fraction] of cases) {
    it(`matches at ${when} UTC`, () => {
      const moon = moonPosition(utc(when), latitude, longitude);
      close(moon.azimuth, azimuth, 0.3);
      close(moon.altitude, altitude, 0.3);
      close(moon.distanceKm, distanceAu * 149_597_870.7, 100);
      close(
        moonIllumination(utc(when), latitude, longitude).fraction,
        fraction,
        0.01
      );
    });
  }
});

describe("moon phases against USNO 2026", () => {
  const full = ["2026-03-03T11:38", "2026-10-26T04:12"];
  const fresh = ["2026-08-12T17:37", "2026-10-10T15:50"];
  for (const when of full) {
    it(`is full at ${when} UTC`, () => {
      const light = moonIllumination(utc(when), latitude, longitude);
      close(light.phase, 0.5, 0.001);
      assert.ok(light.fraction > 0.99);
    });
  }
  for (const when of fresh) {
    it(`is new at ${when} UTC`, () => {
      const light = moonIllumination(utc(when), latitude, longitude);
      close(Math.min(light.phase, 1 - light.phase), 0, 0.001);
      assert.ok(light.fraction < 0.01);
    });
  }
});

describe("moonRiseSet against USNO for Vienna", () => {
  it("matches on 2026-06-21", () => {
    const times = moonRiseSet(utc("2026-06-21T00:00"), latitude, longitude);
    close(times.rise ?? 0, clockMs("2026-06-21", "10:31"), 2 * minute);
    close(times.set ?? 0, clockMs("2026-06-21", "22:41"), 2 * minute);
  });

  it("matches on 2026-10-25", () => {
    const times = moonRiseSet(utc("2026-10-25T00:00"), latitude, longitude);
    close(times.set ?? 0, clockMs("2026-10-25", "04:32"), 2 * minute);
    close(times.rise ?? 0, clockMs("2026-10-25", "15:03"), 2 * minute);
  });
});

type Vec3 = readonly [number, number, number];

const vector = (azimuth: number, altitude: number): Vec3 => [
  Math.sin(azimuth * deg) * Math.cos(altitude * deg),
  Math.cos(azimuth * deg) * Math.cos(altitude * deg),
  Math.sin(altitude * deg),
];

const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const along = (target: Vec3, from: Vec3): Vec3 => {
  const k = dot(target, from);
  return [
    target[0] - from[0] * k,
    target[1] - from[1] * k,
    target[2] - from[2] * k,
  ];
};

describe("moon bright limb", () => {
  for (const when of [
    "2026-06-21T20:00",
    "2026-10-13T16:30",
    "2026-10-18T14:00",
  ]) {
    it(`points at the sun along the sky at ${when} UTC`, () => {
      const at = utc(when);
      const moon = moonPosition(at, latitude, longitude);
      const sun = sunPosition(at, latitude, longitude);
      const m = vector(moon.azimuth, moon.trueAltitude);
      const toSun = along(vector(sun.azimuth, sun.trueAltitude), m);
      const up = along([0, 0, 1], m);
      const left = cross(up, m);
      const expected = Math.atan2(dot(toSun, left), dot(toSun, up)) / deg;
      close(
        moonIllumination(at, latitude, longitude).brightLimbFromZenith,
        expected,
        1
      );
    });
  }

  it("lights the right side of a waxing evening moon", () => {
    const light = moonIllumination(
      utc("2026-10-13T16:30"),
      latitude,
      longitude
    );
    assert.ok(
      light.brightLimbFromZenith < -45 && light.brightLimbFromZenith > -135
    );
    assert.ok(light.phase > 0 && light.phase < 0.25);
  });
});
