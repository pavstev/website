import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readRatio } from "./progress.ts";

describe("readRatio", () => {
  it("is 0 until the article top reaches the top of the window", () => {
    assert.equal(readRatio(400, 3000, 800), 0);
    assert.equal(readRatio(0, 3000, 800), 0);
  });

  it("grows with the scroll and is 1 when the bottom meets the window bottom", () => {
    assert.equal(readRatio(-1100, 3000, 800), 0.5);
    assert.equal(readRatio(-2200, 3000, 800), 1);
  });

  it("stays between 0 and 1 past either end", () => {
    assert.equal(readRatio(-5000, 3000, 800), 1);
    assert.equal(readRatio(900, 3000, 800), 0);
  });

  it("is 0 for an article shorter than the window until it scrolls away", () => {
    assert.equal(readRatio(100, 500, 800), 0);
    assert.equal(readRatio(-1, 500, 800), 1);
  });
});
