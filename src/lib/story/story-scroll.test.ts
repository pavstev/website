import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  easeToward,
  explodeAt,
  overlapsRect,
  splitProgress,
  stepAt,
  type StepOffset,
} from "./story-scroll.ts";

const offsets: StepOffset[] = [
  { height: 800, top: 0 },
  { height: 1200, top: 800 },
];

describe("stepAt", () => {
  it("maps a scroll position inside the first step", () => {
    assert.deepEqual(stepAt(400, offsets), { index: 0, t: 0.5 });
  });

  it("maps a scroll position inside the second step", () => {
    assert.deepEqual(stepAt(1400, offsets), { index: 1, t: 0.5 });
  });

  it("starts the next step exactly at its top", () => {
    assert.deepEqual(stepAt(800, offsets), { index: 1, t: 0 });
  });

  it("clamps past the end to the last step at t 1", () => {
    assert.deepEqual(stepAt(5000, offsets), { index: 1, t: 1 });
  });

  it("clamps before the start to the first step at t 0", () => {
    assert.deepEqual(stepAt(-300, offsets), { index: 0, t: 0 });
  });

  it("gives the first step for an empty list", () => {
    assert.deepEqual(stepAt(100, []), { index: 0, t: 0 });
  });

  it("does not divide by a zero height", () => {
    assert.deepEqual(stepAt(10, [{ height: 0, top: 0 }]), { index: 0, t: 1 });
  });
});

describe("easeToward", () => {
  it("gets above 0.95 of the way in 300 ms", () => {
    assert.ok(easeToward(0, 1, 0.3) > 0.95);
  });

  it("stays put with no time", () => {
    assert.equal(easeToward(0, 1, 0), 0);
  });

  it("never overshoots", () => {
    assert.ok(easeToward(0, 1, 10) <= 1);
    assert.ok(easeToward(1, 0, 10) >= 0);
  });
});

describe("splitProgress", () => {
  it("splits a whole progress into a step and its local time", () => {
    assert.deepEqual(splitProgress(1.25, 3), { index: 1, t: 0.25 });
  });

  it("ends the last step at t 1", () => {
    assert.deepEqual(splitProgress(3, 3), { index: 2, t: 1 });
  });

  it("clamps below zero", () => {
    assert.deepEqual(splitProgress(-2, 3), { index: 0, t: 0 });
  });
});

describe("explodeAt", () => {
  it("is open at both ends of a step and closest to 0.25 in the middle", () => {
    assert.equal(explodeAt(0), 1);
    assert.equal(explodeAt(1), 1);
    assert.equal(explodeAt(0.5), 0.25);
  });

  it("falls then rises", () => {
    assert.ok(explodeAt(0.25) < 1);
    assert.ok(explodeAt(0.25) > 0.25);
    assert.ok(explodeAt(0.75) < 1);
    assert.ok(explodeAt(0.75) > 0.25);
  });
});

describe("overlapsRect", () => {
  const text = { height: 100, left: 50, top: 200, width: 300 };

  it("is true for a box that shares area with the text", () => {
    assert.equal(
      overlapsRect({ height: 20, left: 300, top: 250, width: 100 }, text, 0),
      true
    );
  });

  it("is false for a box clear of the text", () => {
    assert.equal(
      overlapsRect({ height: 20, left: 400, top: 250, width: 100 }, text, 0),
      false
    );
    assert.equal(
      overlapsRect({ height: 20, left: 100, top: 100, width: 100 }, text, 0),
      false
    );
  });

  it("grows the text box by the gap", () => {
    const near = { height: 20, left: 355, top: 250, width: 50 };
    assert.equal(overlapsRect(near, text, 0), false);
    assert.equal(overlapsRect(near, text, 8), true);
  });
});
