import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deg } from "./math.ts";
import { type PlanetName, planetsAt } from "./sky-planets.ts";

interface Reference {
  dec: number;
  magnitude: number;
  ra: number;
}

const horizons: Readonly<
  Record<string, Readonly<Record<PlanetName, Reference>>>
> = {
  "2026-10-14T20:00:00Z": {
    jupiter: { dec: 14.921342841, magnitude: -1.922, ra: 144.135851346 },
    mars: { dec: 19.176716683, magnitude: 1, ra: 131.957133709 },
    mercury: { dec: -19.536465868, magnitude: 0.06, ra: 222.56115843 },
    saturn: { dec: 1.511246674, magnitude: 0.384, ra: 10.361165444 },
    venus: { dec: -20.423930062, magnitude: -4.301, ra: 210.563423151 },
  },
  "2027-03-01T00:00:00Z": {
    jupiter: { dec: 16.030251213, magnitude: -2.521, ra: 142.129062331 },
    mars: { dec: 16.662841694, magnitude: -1.176, ra: 150.519698198 },
    mercury: { dec: -12.264445788, magnitude: 1.202, ra: 322.516464441 },
    saturn: { dec: 2.925804869, magnitude: 0.786, ra: 12.56382639 },
    venus: { dec: -19.541572193, magnitude: -4.076, ra: 301.280102398 },
  },
};

const angleLimit: Readonly<Record<PlanetName, number>> = {
  jupiter: 0.2,
  mars: 0.05,
  mercury: 0.05,
  saturn: 0.2,
  venus: 0.05,
};

const magnitudeLimit = (name: PlanetName): number =>
  name === "saturn" ? 0.3 : 0.15;

const separation = (
  direction: readonly [number, number, number],
  reference: Reference
): number => {
  const ra = reference.ra * deg;
  const dec = reference.dec * deg;
  const cosine =
    direction[0] * Math.cos(dec) * Math.cos(ra) +
    direction[1] * Math.cos(dec) * Math.sin(ra) +
    direction[2] * Math.sin(dec);
  return Math.acos(Math.min(1, cosine)) / deg;
};

describe("planetsAt", () => {
  for (const [time, references] of Object.entries(horizons)) {
    it(`matches JPL Horizons at ${time}`, () => {
      const sights = planetsAt(Date.parse(time));
      assert.equal(sights.length, 5);
      for (const sight of sights) {
        const reference = references[sight.name];
        const angle = separation(sight.direction, reference);
        assert.ok(
          angle < angleLimit[sight.name],
          `${sight.name} is ${angle.toFixed(4)} deg off`
        );
        const magnitudeError = Math.abs(sight.magnitude - reference.magnitude);
        assert.ok(
          magnitudeError < magnitudeLimit(sight.name),
          `${sight.name} magnitude is ${magnitudeError.toFixed(3)} off`
        );
      }
    });
  }

  it("gives unit directions and tints with a full channel", () => {
    const sights = planetsAt(Date.parse("2026-10-14T20:00:00Z"));
    for (const sight of sights) {
      assert.ok(Math.abs(Math.hypot(...sight.direction) - 1) < 1e-12);
      assert.equal(Math.max(...sight.color), 1);
      assert.ok(Math.min(...sight.color) > 0);
    }
  });

  it("lists each planet once", () => {
    const names = planetsAt(0).map((sight) => sight.name);
    assert.deepEqual(
      names.toSorted((a, b) => a.localeCompare(b)),
      ["jupiter", "mars", "mercury", "saturn", "venus"]
    );
  });
});
