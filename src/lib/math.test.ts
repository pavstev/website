import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clamp, clamp01, magnet, smoothstep } from "./math.ts";

describe("clamp", () => {
  it("keeps values inside the range and pins the rest to the ends", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
  });
});

describe("clamp01", () => {
  it("clamps to the unit range", () => {
    assert.equal(clamp01(0.25), 0.25);
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(NaN), 0);
  });
});

describe("smoothstep", () => {
  it("is 0 below, 1 above and 0.5 in the middle", () => {
    assert.equal(smoothstep(2, 4, 1), 0);
    assert.equal(smoothstep(2, 4, 5), 1);
    assert.equal(smoothstep(2, 4, 3), 0.5);
  });

  it("works with a falling range", () => {
    assert.equal(smoothstep(4, 2, 5), 0);
    assert.equal(smoothstep(4, 2, 1), 1);
  });
});

describe("magnet", () => {
  it("pulls to the nearest anchor within reach and leaves the rest", () => {
    assert.equal(magnet(105, [0, 100, 200], 10), 100);
    assert.equal(magnet(110, [0, 100, 200], 10), 100);
    assert.equal(magnet(111, [0, 100, 200], 10), 111);
    assert.equal(magnet(195, [0, 100, 200], 10), 200);
    assert.equal(magnet(50, [], 10), 50);
  });

  it("picks the closer anchor when two are in reach", () => {
    assert.equal(magnet(48, [40, 50], 10), 50);
    assert.equal(magnet(44, [40, 50], 10), 40);
  });
});
