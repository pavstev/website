import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sunPosition } from "./sky-ephemeris.ts";
import { airTint, moonView, screenAngle, skyBearing } from "./sky-moon.ts";

interface Horizons {
  at: string;
  azimuth: number;
  deltaAu: number;
  elevation: number;
  litPercent: number;
  poleAngle: number;
  sunAngle: number;
  sunTargetObserver: number;
}

const auKm = 149_597_870.7;
const viennaLatitude = 48.2082;
const viennaLongitude = 16.3738;

const horizons: readonly Horizons[] = [
  {
    at: "2026-01-20T22:00:00Z",
    azimuth: 300.611775,
    deltaAu: 0.00262570630197,
    elevation: -42.704864,
    litPercent: 4.29995,
    poleAngle: 341.8554,
    sunAngle: 74.19,
    sunTargetObserver: 156.0696,
  },
  {
    at: "2026-03-25T19:00:00Z",
    azimuth: 238.500569,
    deltaAu: 0.00244498873405,
    elevation: 59.369331,
    litPercent: 49.71497,
    poleAngle: 1.3972,
    sunAngle: 91.892,
    sunTargetObserver: 90.3265,
  },
  {
    at: "2026-06-01T21:30:00Z",
    azimuth: 146.31625,
    deltaAu: 0.00271066235866,
    elevation: 5.435685,
    litPercent: 97.59415,
    poleAngle: 1.3235,
    sunAngle: 287.724,
    sunTargetObserver: 17.8512,
  },
  {
    at: "2026-08-28T02:00:00Z",
    azimuth: 229.7432,
    deltaAu: 0.00259866041492,
    elevation: 17.687457,
    litPercent: 99.9739,
    poleAngle: 340.4171,
    sunAngle: 63.106,
    sunTargetObserver: 1.8456,
  },
  {
    at: "2026-10-19T15:30:00Z",
    azimuth: 148.185315,
    deltaAu: 0.00266321931506,
    elevation: 14.558114,
    litPercent: 59.45571,
    poleAngle: 346.5812,
    sunAngle: 74.724,
    sunTargetObserver: 79.0979,
  },
  {
    at: "2026-12-24T06:00:00Z",
    azimuth: 297.824855,
    deltaAu: 0.00237598635283,
    elevation: 10.613542,
    litPercent: 99.90264,
    poleAngle: 0.9902,
    sunAngle: 216.724,
    sunTargetObserver: 3.5794,
  },
];

const turnGap = (a: number, b: number): number =>
  ((((a - b) % 360) + 540) % 360) - 180;

const vienna = (at: string): ReturnType<typeof moonView> =>
  moonView(Date.parse(at), viennaLatitude, viennaLongitude);

describe("moonView against JPL Horizons (Vienna, airless)", () => {
  for (const row of horizons) {
    it(`matches ${row.at}`, () => {
      const moon = vienna(row.at);
      const arc = Math.hypot(
        turnGap(moon.azimuth, row.azimuth) *
          Math.cos((row.elevation * Math.PI) / 180),
        moon.trueAltitude - row.elevation
      );
      assert.ok(arc < 0.006, `position off by ${arc.toFixed(3)} degrees`);
      assert.ok(Math.abs(moon.fraction * 100 - row.litPercent) < 0.01);
      assert.ok(Math.abs(moon.phaseAngle - row.sunTargetObserver) < 0.01);
      assert.ok(Math.abs(moon.distanceKm - row.deltaAu * auKm) < 50);
      assert.ok(Math.abs(turnGap(moon.pole, row.poleAngle)) < 0.025);
      assert.ok(Math.abs(turnGap(moon.brightLimb, row.sunAngle + 180)) < 0.25);
    });
  }
});

describe("moon phase", () => {
  it("names the phase from new through full and back", () => {
    assert.ok(vienna("2026-01-20T22:00:00Z").phase < 0.1);
    assert.ok(Math.abs(vienna("2026-03-25T19:00:00Z").phase - 0.25) < 0.02);
    assert.ok(Math.abs(vienna("2026-08-28T02:00:00Z").phase - 0.5) < 0.02);
    assert.ok(vienna("2026-06-01T21:30:00Z").phase > 0.5);
  });

  it("lights a waxing evening crescent toward the set sun", () => {
    const at = Date.parse("2026-01-21T17:00:00+01:00");
    const moon = moonView(at, viennaLatitude, viennaLongitude);
    const sun = sunPosition(at, viennaLatitude, viennaLongitude);
    assert.ok(moon.trueAltitude > 0 && sun.trueAltitude < 0);
    assert.ok(moon.phase < 0.25 && moon.fraction < 0.2);
    const limb = screenAngle(moon.brightLimb, moon.parallactic);
    assert.ok(limb > 90 && limb < 180, `limb at ${limb.toFixed(1)}`);
    const toward = skyBearing(
      { altitude: moon.trueAltitude, azimuth: moon.azimuth },
      { altitude: sun.trueAltitude, azimuth: sun.azimuth }
    );
    assert.ok(Math.abs(turnGap(limb, toward)) < 1);
  });

  it("turns position angles onto the screen with east on the left", () => {
    assert.equal(screenAngle(0, 0), 0);
    assert.equal(screenAngle(90, 0), -90);
    assert.equal(screenAngle(270, 0), 90);
    assert.equal(screenAngle(10, 30), 20);
  });
});

describe("airTint", () => {
  it("warms and dims the low moon", () => {
    assert.ok(airTint(60).every((c) => c > 0.9));
    const [r, g, b] = airTint(5);
    assert.ok(r > g && g > b);
  });

  it("stays finite below the horizon", () => {
    assert.ok(airTint(-30).every((c) => Number.isFinite(c) && c > 0));
  });
});
