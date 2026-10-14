import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sunPosition } from "./sky-ephemeris.ts";

const latitude = 48.2082;
const longitude = 16.3738;

const close = (actual: number, expected: number, within: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${String(actual)} is not within ${String(within)} of ${String(expected)}`
  );
};

const utc = (text: string): number => Date.parse(`${text}Z`);

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
