import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deg } from "./math.ts";
import { equatorialToWorld, type Mat3, worldToGalactic } from "./sky-frame.ts";
import { decodeStars, starColor } from "./sky-stars.ts";
import { starCount } from "./star-data.ts";

type Vector = readonly [number, number, number];

const vienna = { latitude: 48.2082, longitude: 16.3738 };
const horizonsInstant = Date.UTC(2026, 9, 14, 10);
const horizonsSun = {
  azimuth: 168.035703198,
  dec: -8.086631992,
  elevation: 32.860388099,
  ra: 199.129294436,
};

const apply = (m: Mat3, v: Vector): Vector => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];

const fromRaDec = (ra: number, dec: number): Vector => [
  Math.cos(dec * deg) * Math.cos(ra * deg),
  Math.cos(dec * deg) * Math.sin(ra * deg),
  Math.sin(dec * deg),
];

const star = (stars: Float32Array, index: number): number[] => [
  ...stars.subarray(index * 7, index * 7 + 7),
];

const altitude = (v: Vector): number => Math.asin(v[1]) / deg;

const azimuth = (v: Vector): number =>
  (((Math.atan2(v[0], v[2]) / deg) % 360) + 360) % 360;

describe("decodeStars", () => {
  const stars = decodeStars();

  it("decodes every star with a unit vector and a colour", () => {
    assert.equal(stars.length, starCount * 7);
    assert.ok(starCount > 9000);
    for (let index = 0; index < starCount; index += 97) {
      const [x = 0, y = 0, z = 0, , r = 0, g = 0, b = 0] = star(stars, index);
      assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-5);
      assert.ok(Math.abs(Math.max(r, g, b) - 1) < 1e-5);
    }
  });

  it("puts Sirius first", () => {
    const [x = 0, y = 0, z = 0, magnitude = 0] = star(stars, 0);
    assert.ok(Math.abs(magnitude + 1.46) < 0.03);
    const ra = (((Math.atan2(y, x) / deg) % 360) + 360) % 360;
    assert.ok(Math.abs(ra - 101.29) < 0.05);
    assert.ok(Math.abs(Math.asin(z) / deg + 16.72) < 0.05);
  });

  it("keeps Polaris near the pole", () => {
    const polaris = Array.from({ length: starCount }, (_, index) =>
      star(stars, index)
    ).find((entry) => (entry[2] ?? 0) > 0.9998 && (entry[3] ?? 99) < 2.5);
    assert.ok(polaris);
    assert.ok(Math.abs((polaris[3] ?? 0) - 2.02) < 0.05);
  });
});

describe("starColor", () => {
  it("turns hot stars blue and cool stars red", () => {
    const [hotR, , hotB] = starColor(-0.3);
    const [coolR, , coolB] = starColor(1.6);
    assert.ok(hotB > hotR);
    assert.ok(coolR > coolB);
  });
});

describe("equatorialToWorld", () => {
  it("lifts Polaris to the Vienna latitude", () => {
    const m = equatorialToWorld(
      Date.parse("2026-10-14T20:00:00Z"),
      vienna.latitude,
      vienna.longitude
    );
    const polaris = apply(m, fromRaDec(37.95, 89.264));
    assert.ok(Math.abs(altitude(polaris) - vienna.latitude) < 1);
    assert.ok(Math.abs(Math.hypot(...polaris) - 1) < 1e-12);
  });

  it("matches the JPL Horizons airless Sun", () => {
    const m = equatorialToWorld(
      horizonsInstant,
      vienna.latitude,
      vienna.longitude
    );
    const sun = apply(m, fromRaDec(horizonsSun.ra, horizonsSun.dec));
    assert.ok(Math.abs(altitude(sun) - horizonsSun.elevation) < 0.02);
    assert.ok(Math.abs(azimuth(sun) - horizonsSun.azimuth) < 0.02);
  });
});

describe("worldToGalactic", () => {
  it("sends the galactic centre to l = 0, b = 0", () => {
    const toWorld = equatorialToWorld(
      horizonsInstant,
      vienna.latitude,
      vienna.longitude
    );
    const toGalactic = worldToGalactic(
      horizonsInstant,
      vienna.latitude,
      vienna.longitude
    );
    const centre = apply(
      toGalactic,
      apply(toWorld, fromRaDec(266.405, -28.936))
    );
    assert.ok(Math.abs(Math.asin(centre[2]) / deg) < 0.01);
    assert.ok(Math.abs(Math.atan2(centre[1], centre[0]) / deg) < 0.01);
  });

  it("sends the north celestial pole to l = 122.93", () => {
    const toWorld = equatorialToWorld(
      horizonsInstant,
      vienna.latitude,
      vienna.longitude
    );
    const toGalactic = worldToGalactic(
      horizonsInstant,
      vienna.latitude,
      vienna.longitude
    );
    const pole = apply(toGalactic, apply(toWorld, [0, 0, 1]));
    assert.ok(Math.abs(Math.atan2(pole[1], pole[0]) / deg - 122.93192) < 1e-6);
    assert.ok(Math.abs(Math.asin(pole[2]) / deg - 27.12825) < 1e-6);
  });
});
