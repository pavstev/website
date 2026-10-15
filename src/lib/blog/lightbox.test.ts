import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clamp,
  isSwipe,
  isTap,
  landing,
  panLimit,
  swipeDistance,
} from "./lightbox.ts";

describe("clamp", () => {
  it("keeps a value inside the range", () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-5, 0, 3), 0);
    assert.equal(clamp(2, 0, 3), 2);
  });
});

describe("panLimit", () => {
  it("is zero while the picture fits the frame", () => {
    assert.equal(panLimit(400, 800, 1), 0);
    assert.equal(panLimit(400, 800, 1.5), 0);
  });

  it("is half the overflow once it is larger", () => {
    assert.equal(panLimit(400, 800, 4), 400);
  });
});

describe("isTap and isSwipe", () => {
  it("tells a tap from a drag", () => {
    assert.equal(isTap(2, 3), true);
    assert.equal(isTap(8, 0), false);
  });

  it("swipes only from the fitted view and past the distance", () => {
    assert.equal(isSwipe(0, swipeDistance, 1), true);
    assert.equal(isSwipe(0, swipeDistance - 1, 1), false);
    assert.equal(isSwipe(0, swipeDistance * 2, 2), false);
  });
});

describe("landing", () => {
  const frame = { height: 600, left: 0, top: 0, width: 1000 };

  it("maps the frame center to the origin center and scales by width", () => {
    const origin = { height: 100, left: 100, top: 400, width: 200 };
    assert.deepEqual(landing(frame, origin, 800), {
      dx: -300,
      dy: 150,
      scale: 0.25,
    });
  });

  it("gives up on an origin without a size", () => {
    const origin = { height: 0, left: 0, top: 0, width: 0 };
    assert.equal(landing(frame, origin, 800), null);
    assert.equal(
      landing(frame, { height: 1, left: 0, top: 0, width: 1 }, 0),
      null
    );
  });
});
