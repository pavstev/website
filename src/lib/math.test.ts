import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clamp, clamp01, smoothstep } from "./math.ts";

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
