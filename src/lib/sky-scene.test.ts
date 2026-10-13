import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addWorldPuff,
  agePuffs,
  cameraFor,
  easeLean,
  easeLook,
  landmarkUniforms,
  lookTarget,
  pickLandmark,
  projectPoint,
  puffStrength,
  puffUniforms,
  worldPuff,
} from "./sky-scene.ts";
import { buildSkyline } from "./skyline.ts";

const camera = cameraFor(1440, 900);

describe("world puffs", () => {
  it("puts a puff on the cloud base in front of the viewer", () => {
    const puff = worldPuff(0.5, 0.6, 1.6, camera, [0, 0]);
    assert.ok(Math.abs(puff.x) < 1e-6);
    assert.ok(puff.z > 1000 && puff.z <= 9000);
  });

  it("rises, settles and fades away", () => {
    const puff = worldPuff(0.3, 0.7, 1.6, camera, [0, 0]);
    assert.equal(puffStrength(puff), 0);
    assert.ok(puffStrength({ ...puff, age: 0.7 }) > 0.89);
    assert.deepEqual(agePuffs([puff], 60), []);
  });

  it("keeps at most six, dropping the weakest", () => {
    let puffs = [] as ReturnType<typeof addWorldPuff>;
    for (let i = 0; i < 8; i += 1)
      puffs = addWorldPuff(
        agePuffs(puffs, 0.1),
        worldPuff(0.1 * i, 0.7, 1.6, camera, [0, 0])
      );
    assert.equal(puffs.length, 6);
    assert.equal(puffUniforms(puffs).length, 24);
  });
});

describe("camera", () => {
  it("projects the horizon line at the horizon share", () => {
    const point = projectPoint(
      [0, camera.eye, 50_000],
      camera,
      [0, 0],
      1440,
      900
    );
    assert.ok(point);
    assert.ok(Math.abs(point[1] - 900 * (1 - camera.horizon)) < 0.5);
  });

  it("eases the look toward the pointer and stops", () => {
    const look: [number, number] = [0, 0];
    const target = lookTarget([1, -1]);
    assert.ok(easeLook(look, target, 0.1));
    for (let i = 0; i < 200; i += 1) easeLook(look, target, 0.1);
    assert.equal(easeLook(look, target, 0.1), false);
  });
});

describe("landmarks", () => {
  const skyline = buildSkyline();

  it("finds the Stephansdom under its spire", () => {
    const dom = skyline.landmarks[0];
    assert.ok(dom);
    const spire = projectPoint([dom.x, 60, dom.z], camera, [0, 0], 1440, 900);
    assert.ok(spire);
    const hover = pickLandmark(
      skyline.landmarks,
      camera,
      [0, 0],
      spire,
      1440,
      900
    );
    assert.equal(hover?.id, 0);
  });

  it("leans the hovered landmark and lets it go", () => {
    const data = landmarkUniforms(skyline.landmarks);
    assert.ok(easeLean(data, { id: 3, side: 1 }, 0.1));
    assert.ok((data[3 * 4 + 3] ?? 0) > 0);
    for (let i = 0; i < 100; i += 1) easeLean(data, undefined, 0.1);
    assert.ok(Math.abs(data[3 * 4 + 3] ?? 1) < 0.01);
  });
});
