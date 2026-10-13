import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { landmarkCount } from "./sky-scene.ts";
import { buildSkyline, skylineStride } from "./skyline.ts";

const skyline = buildSkyline();

describe("buildSkyline", () => {
  it("packs whole triangles of twelve floats", () => {
    assert.equal(skyline.geometry.length, skyline.count * skylineStride);
    assert.equal(skyline.count % 3, 0);
    assert.ok(skyline.count > 10_000);
  });

  it("is the same on every build", () => {
    assert.deepEqual(buildSkyline().geometry, skyline.geometry);
  });

  it("places all sixteen landmarks in front of the viewer", () => {
    assert.equal(skyline.landmarks.length, landmarkCount);
    for (const meta of skyline.landmarks) {
      assert.ok(meta.z > 0, `landmark ${String(meta.id)} is behind the eye`);
      const [x0, y0, , x1, y1] = meta.box;
      assert.ok(x1 > x0 && y1 > y0);
      assert.ok(y0 > -1);
    }
  });

  it("draws far parts first", () => {
    const depth = (vertex: number): number => {
      const at = vertex * skylineStride;
      return Math.hypot(
        skyline.geometry[at] ?? 0,
        skyline.geometry[at + 2] ?? 0
      );
    };
    assert.ok(depth(0) > depth(skyline.count - 1));
  });

  it("marks real edges only, never a quad diagonal on a box", () => {
    const codes = new Set<number>();
    for (let v = 0; v < skyline.count; v += 1)
      codes.add(
        Math.floor((skyline.geometry[v * skylineStride + 10] ?? 0) / 3)
      );
    for (const code of codes) assert.ok(code >= 0 && code < 8);
    assert.ok(codes.has(0));
  });

  it("keeps the aviation lights as points", () => {
    assert.equal(skyline.lights.length, skyline.lightCount * skylineStride);
    assert.ok(skyline.lightCount >= 8);
    for (let i = 0; i < skyline.lightCount; i += 1)
      assert.equal(skyline.lights[i * skylineStride + 7], 99);
  });

  it("turns the Riesenrad around a level axle at its hub", () => {
    assert.equal(skyline.wheel.axle[1], 0);
    assert.ok(Math.abs(Math.hypot(...skyline.wheel.axle) - 1) < 1e-9);
    assert.equal(skyline.wheel.hub[1], 34.5);
  });
});
