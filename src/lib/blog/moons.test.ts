import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  moonPhase,
  moonPosition,
  moonRadius,
  moonSide,
  orbitFor,
  sharedTags,
  startAngle,
} from "./moons.ts";

const desktop = { height: 900, width: 1440 };
const phone = { height: 568, width: 320 };

describe("moons", () => {
  it("names the side and the depth of a moon", () => {
    assert.equal(moonSide(1, -1), "end front");
    assert.equal(moonSide(0, 1), "end back");
    assert.equal(moonSide(-1, -1), "start front");
    assert.equal(moonSide(-1, 1), "start back");
  });

  it("mirrors the positions at angle 0 and pi", () => {
    const orbit = orbitFor(0, 2, 48, desktop);
    const right = moonPosition(orbit, 0);
    const left = moonPosition(orbit, Math.PI);
    assert.ok(Math.abs(right.x + left.x) < 1e-9);
    assert.ok(Math.abs(right.y - left.y) < 1e-9);
    assert.ok(Math.abs(right.depth - left.depth) < 1e-9);
    assert.ok(right.x > 0);
  });

  it("puts the lower half of the orbit in front of the eclipse", () => {
    const orbit = orbitFor(0, 2, 48, desktop);
    const front = moonPosition(orbit, Math.PI / 2);
    const back = moonPosition(orbit, -Math.PI / 2);
    assert.ok(front.depth < 0 && front.y > 0);
    assert.ok(back.depth > 0 && back.y < 0);
  });

  it("darkens a moon in front and fills one behind", () => {
    const orbit = orbitFor(1, 3, 48, desktop);
    const front = moonPosition(orbit, Math.PI / 2 - 0.3);
    const back = moonPosition(orbit, -Math.PI / 2 + 0.3);
    assert.ok(moonPhase(front.depth, front.x) < 0.2);
    assert.ok(moonPhase(back.depth, back.x) > 0.8);
    assert.equal(moonPhase(0, 0), 0.5);
  });

  it("grows the moon with reading time between 10 and 22 px", () => {
    assert.equal(moonRadius(1), 10);
    assert.equal(moonRadius(60), 22);
    assert.equal(moonRadius(0), 10);
    assert.equal(moonRadius(240), 22);
    assert.ok(moonRadius(10) > 14 && moonRadius(10) < 19);
  });

  it("lists the tags two posts share", () => {
    assert.deepEqual(sharedTags(["a", "b"], ["b", "c"]), ["b"]);
    assert.deepEqual(sharedTags(["a"], ["c"]), []);
  });

  it("keeps desktop orbits between 1.9 and 2.6 eclipse radii at about 65 degrees", () => {
    for (let count = 1; count <= 8; count += 1) {
      for (let index = 0; index < count; index += 1) {
        const orbit = orbitFor(index, count, 48, desktop);
        assert.ok(orbit.rx >= 1.9 * 48 - 1e-9 && orbit.rx <= 2.6 * 48 + 1e-9);
        assert.ok(Math.abs(orbit.tilt - (65 * Math.PI) / 180) < 0.1);
        assert.ok(Math.abs(orbit.ry - orbit.rx * Math.cos(orbit.tilt)) < 1e-9);
        assert.ok(orbit.period >= 50 && orbit.period <= 90);
      }
    }
  });

  it("uses smaller orbits on phones", () => {
    const wide = orbitFor(2, 3, 48, desktop);
    const narrow = orbitFor(2, 3, 48, { height: 844, width: 390 });
    assert.ok(narrow.rx < wide.rx);
  });

  it("keeps every moon inside the viewport at 320x568", () => {
    for (let count = 1; count <= 8; count += 1) {
      for (let index = 0; index < count; index += 1) {
        const orbit = orbitFor(index, count, 48, phone);
        for (let step = 0; step < 64; step += 1) {
          const { x, y } = moonPosition(orbit, (step / 64) * Math.PI * 2);
          const edge = moonRadius(60);
          assert.ok(Math.abs(x) + edge <= phone.width / 2);
          assert.ok(Math.abs(y) + edge <= phone.height / 2);
        }
      }
    }
  });

  it("spreads the start angles around the orbit", () => {
    const angles = [0, 1, 2, 3].map((index) => startAngle(index, 4));
    const gaps = angles.slice(1).map((angle, i) => angle - (angles[i] ?? 0));
    for (const gap of gaps) assert.ok(Math.abs(gap - Math.PI / 2) < 1e-9);
  });
});
