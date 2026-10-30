import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tapSides } from "./topic-taps.ts";

const box = (left: number, top: number, right: number) => ({
  bottom: top + 18,
  left,
  right,
  top,
});

describe("tapSides", () => {
  it("grows a word up and the word under it down", () => {
    assert.deepEqual(tapSides([box(100, 0, 160), box(120, 25, 220)], 44), [
      "up",
      "down",
    ]);
  });

  it("leaves words on one line alone", () => {
    assert.deepEqual(tapSides([box(0, 0, 50), box(60, 0, 110)], 44), [
      undefined,
      undefined,
    ]);
  });

  it("leaves words that do not share a column alone", () => {
    assert.deepEqual(tapSides([box(0, 0, 50), box(80, 25, 140)], 44), [
      undefined,
      undefined,
    ]);
  });

  it("leaves a word with neighbours above and below centered", () => {
    assert.deepEqual(
      tapSides([box(0, 0, 80), box(0, 25, 80), box(0, 50, 80)], 44),
      ["up", undefined, "down"]
    );
  });

  it("reaches further when the text is zoomed", () => {
    assert.deepEqual(tapSides([box(0, 0, 80), box(0, 60, 80)], 88), [
      "up",
      "down",
    ]);
  });

  it("leaves lines far apart alone", () => {
    assert.deepEqual(tapSides([box(0, 0, 80), box(0, 60, 80)], 44), [
      undefined,
      undefined,
    ]);
  });
});
