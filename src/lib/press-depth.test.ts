import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isInside, pressOrigin, withLip } from "./press-depth.ts";

const rect = {
  bottom: 140,
  height: 40,
  left: 100,
  right: 200,
  top: 100,
  width: 100,
};

describe("pressOrigin", () => {
  it("is 0, 0 at the center", () => {
    assert.deepEqual(pressOrigin(150, 120, rect), { x: 0, y: 0 });
  });

  it("is -1, -1 at the top left and 1, 1 at the bottom right", () => {
    assert.deepEqual(pressOrigin(100, 100, rect), { x: -1, y: -1 });
    assert.deepEqual(pressOrigin(200, 140, rect), { x: 1, y: 1 });
  });

  it("clamps a point outside the box", () => {
    assert.deepEqual(pressOrigin(500, -50, rect), { x: 1, y: -1 });
  });

  it("returns 0, 0 for an empty box", () => {
    assert.deepEqual(
      pressOrigin(5, 5, {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
      }),
      { x: 0, y: 0 }
    );
  });
});

describe("withLip", () => {
  it("grows the box downward by the lip, like interior's button padding", () => {
    assert.deepEqual(withLip(rect, 4), {
      bottom: 144,
      height: 44,
      left: 100,
      right: 200,
      top: 100,
      width: 100,
    });
  });

  it("keeps a point on the lip inside the press zone", () => {
    assert.equal(isInside(150, 143, rect), false);
    assert.equal(isInside(150, 143, withLip(rect, 4)), true);
  });

  it("measures the press origin over the box with the lip", () => {
    assert.deepEqual(pressOrigin(150, 144, withLip(rect, 4)), { x: 0, y: 1 });
  });
});

describe("isInside", () => {
  it("includes the edges and excludes the rest", () => {
    assert.equal(isInside(100, 100, rect), true);
    assert.equal(isInside(200, 140, rect), true);
    assert.equal(isInside(201, 120, rect), false);
    assert.equal(isInside(150, 99, rect), false);
  });
});
