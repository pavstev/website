import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addWorldPuff,
  agePuffs,
  cloudLayer,
  easeLook,
  lookTarget,
  puffStrength,
  puffUniforms,
  worldPuff,
} from "./sky-scene.ts";
import { worldDirection } from "./sky-view.ts";

describe("world puffs", () => {
  it("puts a puff on the cloud layer along the pointer ray", () => {
    const ray = worldDirection(30, 0);
    const puff = worldPuff(ray, 2, [0, 0]);
    assert.ok(Math.abs(puff.x) < 1e-6);
    const expected = (cloudLayer - 2) / Math.tan(Math.PI / 6);
    assert.ok(Math.abs(puff.z - expected) < 1);
  });

  it("rises, settles and fades away", () => {
    const puff = worldPuff(worldDirection(20, 90), 2, [0, 0]);
    assert.equal(puffStrength(puff), 0);
    assert.ok(puffStrength({ ...puff, age: 0.7 }) > 0.89);
    assert.deepEqual(agePuffs([puff], 60), []);
  });

  it("keeps at most six, dropping the weakest", () => {
    let puffs = [] as ReturnType<typeof addWorldPuff>;
    for (let i = 0; i < 8; i += 1)
      puffs = addWorldPuff(
        agePuffs(puffs, 0.1),
        worldPuff(worldDirection(25, 10 * i), 2, [0, 0])
      );
    assert.equal(puffs.length, 6);
    assert.equal(puffUniforms(puffs).length, 24);
  });
});

describe("look", () => {
  it("eases the look toward the pointer and stops", () => {
    const look: [number, number] = [0, 0];
    const target = lookTarget([1, -1]);
    assert.ok(easeLook(look, target, 0.1));
    for (let i = 0; i < 200; i += 1) easeLook(look, target, 0.1);
    assert.equal(easeLook(look, target, 0.1), false);
  });
});
