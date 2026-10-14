import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addWorldPuff,
  agePuffs,
  cloudLayer,
  easeLook,
  type Look,
  lookTarget,
  orbitBoost,
  orbitStep,
  orbitWrap,
  puffStrength,
  puffUniforms,
  worldPuff,
  type WorldPuff,
} from "./sky-scene.ts";
import { eyeAltitude, worldDirection } from "./sky-view.ts";

const puffAt = (altitude: number, azimuth: number): WorldPuff => {
  const puff = worldPuff(
    worldDirection(altitude, azimuth),
    eyeAltitude,
    [0, 0]
  );
  assert.ok(puff);
  return puff;
};

describe("world puffs", () => {
  it("puts a puff on the cloud deck below along the pointer ray", () => {
    const puff = puffAt(-30, 0);
    assert.ok(Math.abs(puff.x) < 1e-6);
    const flat = (eyeAltitude - cloudLayer) / Math.tan(Math.PI / 6);
    assert.ok(puff.z > flat && puff.z < flat * 1.05);
  });

  it("finds no cloud in the sky or behind the limb", () => {
    assert.equal(
      worldPuff(worldDirection(30, 0), eyeAltitude, [0, 0]),
      undefined
    );
    assert.equal(
      worldPuff(worldDirection(-5, 0), eyeAltitude, [0, 0]),
      undefined
    );
  });

  it("rises, settles and fades away", () => {
    const puff = puffAt(-40, 90);
    assert.equal(puffStrength(puff), 0);
    assert.ok(puffStrength({ ...puff, age: 0.7 }) > 0.89);
    assert.deepEqual(agePuffs([puff], 60), []);
  });

  it("keeps at most six, dropping the weakest", () => {
    let puffs = [] as ReturnType<typeof addWorldPuff>;
    for (let i = 0; i < 8; i += 1)
      puffs = addWorldPuff(agePuffs(puffs, 0.1), puffAt(-35, 10 * i));
    assert.equal(puffs.length, 6);
    assert.equal(puffUniforms(puffs).length, 24);
  });
});

describe("look", () => {
  it("eases the look toward the pointer and stops", () => {
    const look: Look = [0, 0, 0];
    const target = lookTarget([1, -1]);
    assert.ok(easeLook(look, target, 0.1));
    for (let i = 0; i < 200; i += 1) easeLook(look, target, 0.1);
    assert.equal(easeLook(look, target, 0.1), false);
  });

  it("rolls and pitches toward the pointer, and rests without one", () => {
    const [yaw, pitch, roll] = lookTarget([1, -1]);
    assert.ok(yaw > 0 && pitch > 0 && roll > 0);
    assert.deepEqual(lookTarget(undefined), [0, 0, 0]);
    assert.ok(Math.abs(roll) < 0.1);
  });
});

describe("orbit", () => {
  it("slides sideways when the view faces north", () => {
    const orbit: [number, number] = [0, 0];
    orbitStep(orbit, 0, 1, 0);
    assert.ok(orbit[0] > 1000 && orbit[1] > 0 && orbit[0] > orbit[1]);
  });

  it("goes faster with the boost and never past the wrap", () => {
    const slow: [number, number] = [0, 0];
    const fast: [number, number] = [0, 0];
    orbitStep(slow, 0.7, 1, 0);
    orbitStep(fast, 0.7, 1, orbitBoost(1));
    assert.ok(Math.hypot(...fast) > 7 * Math.hypot(...slow));
    const edge: [number, number] = [orbitWrap - 1, -(orbitWrap - 1)];
    orbitStep(edge, 0, 10, 0);
    assert.ok(Math.abs(edge[0]) < orbitWrap && Math.abs(edge[1]) < orbitWrap);
  });

  it("boosts smoothly from none to the top", () => {
    assert.equal(orbitBoost(0), 0);
    assert.ok(orbitBoost(0.5) > 0 && orbitBoost(0.5) < orbitBoost(1));
    assert.equal(orbitBoost(5), orbitBoost(1));
  });
});
