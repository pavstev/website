import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { subsolarPoint } from "./sun.ts";

const near = (actual: number, expected: number, tolerance: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${String(actual)} is not within ${String(tolerance)} of ${String(expected)}`
  );
};

describe("subsolarPoint", () => {
  it("puts the sun over the equator at the March 2026 equinox", () => {
    near(subsolarPoint(new Date("2026-03-20T14:46:00Z")).latitude, 0, 0.05);
  });

  it("puts the sun over the Tropic of Cancer at the June 2026 solstice", () => {
    near(
      subsolarPoint(new Date("2026-06-21T08:24:00Z")).latitude,
      23.436,
      0.02
    );
  });

  it("puts the sun over the Tropic of Capricorn at the December 2026 solstice", () => {
    near(
      subsolarPoint(new Date("2026-12-21T20:50:00Z")).latitude,
      -23.436,
      0.02
    );
  });

  it("keeps the noon sun within the equation of time of Greenwich", () => {
    for (const month of ["01", "04", "07", "10"]) {
      const { longitude } = subsolarPoint(
        new Date(`2026-${month}-15T12:00:00Z`)
      );
      assert.ok(Math.abs(longitude) < 4.5, `${month}: ${String(longitude)}`);
    }
  });

  it("follows the equation of time in sign", () => {
    near(subsolarPoint(new Date("2026-02-11T12:00:00Z")).longitude, 3.55, 0.3);
    near(subsolarPoint(new Date("2026-11-03T12:00:00Z")).longitude, -4.1, 0.3);
  });

  it("moves the sun 15 degrees west every hour", () => {
    const before = subsolarPoint(new Date("2026-10-08T09:00:00Z"));
    const after = subsolarPoint(new Date("2026-10-08T10:00:00Z"));
    near(before.longitude - after.longitude, 15, 0.05);
  });

  it("wraps the longitude into -180 to 180", () => {
    const { longitude } = subsolarPoint(new Date("2026-10-08T23:59:00Z"));
    assert.ok(longitude >= -180 && longitude <= 180);
  });
});
