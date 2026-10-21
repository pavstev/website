import assert from "node:assert/strict";
import { test } from "node:test";

import { inside, rectsOverlap } from "./check-story.ts";

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number
): { bottom: number; left: number; right: number; top: number } => ({
  bottom,
  left,
  right,
  top,
});

test("rectsOverlap is true when two boxes share area", () => {
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(5, 5, 15, 15)), true);
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(2, 2, 4, 4)), true);
});

test("rectsOverlap is false for boxes apart or only touching", () => {
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(20, 0, 30, 10)), false);
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(0, 20, 10, 30)), false);
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(10, 0, 20, 10)), false);
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(0, 10, 10, 20)), false);
});

test("rectsOverlap ignores empty boxes", () => {
  assert.equal(rectsOverlap(box(0, 0, 10, 10), box(5, 5, 5, 5)), false);
});

test("inside is true when the inner box sits within the outer one", () => {
  assert.equal(inside(box(2, 2, 8, 8), box(0, 0, 10, 10)), true);
  assert.equal(inside(box(0, 0, 10, 10), box(0, 0, 10, 10)), true);
});

test("inside is false when any edge leaves the outer box", () => {
  assert.equal(inside(box(-3, 2, 8, 8), box(0, 0, 10, 10)), false);
  assert.equal(inside(box(2, -3, 8, 8), box(0, 0, 10, 10)), false);
  assert.equal(inside(box(2, 2, 14, 8), box(0, 0, 10, 10)), false);
  assert.equal(inside(box(2, 2, 8, 14), box(0, 0, 10, 10)), false);
});

test("inside allows a sub-pixel slack and no more", () => {
  assert.equal(inside(box(-0.4, 0, 10.4, 10), box(0, 0, 10, 10)), true);
  assert.equal(inside(box(-1.5, 0, 10, 10), box(0, 0, 10, 10)), false);
});
