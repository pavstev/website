import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chapterAt,
  readSpot,
  snapChapter,
  steadySpots,
} from "./sky-story-scroll.ts";

const spots = [0, 1000, 2000, 4000];

describe("chapterAt", () => {
  it("is the step index at each read spot", () => {
    for (const [index, spot] of spots.entries()) {
      assert.equal(chapterAt(spot, spots), index);
    }
  });
  it("runs linearly between two spots", () => {
    assert.equal(chapterAt(500, spots), 0.5);
    assert.equal(chapterAt(1500, spots), 1.5);
    assert.equal(chapterAt(3000, spots), 2.5);
  });
  it("holds the first and the last chapter outside the spots", () => {
    assert.equal(chapterAt(-300, spots), 0);
    assert.equal(chapterAt(9000, spots), 3);
  });
  it("is zero for no spot and for one spot", () => {
    assert.equal(chapterAt(120, []), 0);
    assert.equal(chapterAt(120, [50]), 0);
  });
  it("never divides by zero when two spots meet", () => {
    const value = chapterAt(100, [0, 100, 100, 300]);
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 1 && value <= 3);
  });
});

describe("snapChapter", () => {
  it("rounds to the nearest step", () => {
    assert.equal(snapChapter(2.4), 2);
    assert.equal(snapChapter(2.5), 3);
    assert.equal(snapChapter(7.9), 8);
  });
});

describe("readSpot", () => {
  it("puts the text bottom on the read line", () => {
    assert.equal(
      readSpot({ height: 300, top: 2000 }, { bar: 48, line: 0.88, view: 800 }),
      2000 + 300 - 704
    );
  });
  it("keeps a tall text under the bar", () => {
    assert.equal(
      readSpot({ height: 900, top: 2000 }, { bar: 48, line: 0.88, view: 800 }),
      1952
    );
  });
});

describe("steadySpots", () => {
  it("never lets a spot fall behind the one before", () => {
    assert.deepEqual(steadySpots([0, 500, 300, 900]), [0, 500, 500, 900]);
  });
  it("keeps every spot inside the scrollable range", () => {
    assert.deepEqual(
      steadySpots([-80, 400, 1200, 1500], 1000),
      [0, 400, 1000, 1000]
    );
  });
  it("leaves a rising list alone", () => {
    assert.deepEqual(steadySpots([10, 20, 30]), [10, 20, 30]);
  });
});
