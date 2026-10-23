import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hexOf, posterAt, posterStyle } from "./sky-story-poster.ts";
import { skyStorySteps } from "./sky-story.ts";

const hex = /^#[0-9a-f]{6}$/u;

describe("hexOf", () => {
  it("writes unit channels as six hex digits", () => {
    assert.equal(hexOf([0, 0.5, 1]), "#0080ff");
  });
  it("clamps channels outside the unit range", () => {
    assert.equal(hexOf([-1, 2, 0]), "#00ff00");
  });
});

describe("posterAt", () => {
  const posters = skyStorySteps.map((_, index) => posterAt(index));

  it("gives every step three real colors", () => {
    assert.equal(posters.length, 9);
    for (const poster of posters) {
      assert.match(poster.top, hex);
      assert.match(poster.mid, hex);
      assert.match(poster.low, hex);
    }
  });
  it("paints the night darker than midday", () => {
    assert.equal(posters[3]?.bright, true);
    assert.equal(posters[6]?.bright, false);
    assert.notEqual(posters[3]?.mid, posters[6]?.mid);
  });
  it("is the same every time", () => {
    assert.deepEqual(posterAt(4), posterAt(4));
  });
});

describe("posterStyle", () => {
  it("passes the colors as custom properties", () => {
    const style = posterStyle(posterAt(0));
    assert.match(style, /--sky-top: #[0-9a-f]{6}/u);
    assert.match(style, /--sky-mid: #[0-9a-f]{6}/u);
    assert.match(style, /--sky-low: #[0-9a-f]{6}/u);
  });
});
