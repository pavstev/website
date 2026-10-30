import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchIndex, stepIndex } from "./select-menu.ts";

describe("stepIndex", () => {
  it("wraps at both ends", () => {
    assert.equal(stepIndex(3, 1, 4), 0);
    assert.equal(stepIndex(0, -1, 4), 3);
    assert.equal(stepIndex(1, 1, 4), 2);
  });
  it("returns -1 for an empty list", () => {
    assert.equal(stepIndex(0, 1, 0), -1);
  });
});

describe("matchIndex", () => {
  const labels = ["Featured", "Stars", "Recently updated", "A to Z"];
  it("finds the next label that starts with one letter", () => {
    assert.equal(matchIndex(labels, "s", 0), 1);
    assert.equal(matchIndex(labels, "a", 3), 3);
  });
  it("keeps the current label while more letters match", () => {
    assert.equal(matchIndex(labels, "st", 1), 1);
  });
  it("returns -1 when nothing matches", () => {
    assert.equal(matchIndex(labels, "q", 0), -1);
  });
});
