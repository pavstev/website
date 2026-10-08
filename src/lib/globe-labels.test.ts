import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type LabelBox, placeLabels } from "./globe-labels.ts";

const box = (key: string, x: number, y: number): LabelBox => ({
  height: 10,
  key,
  width: 40,
  x,
  y,
});

describe("placeLabels", () => {
  it("keeps every label when none overlap", () => {
    const kept = placeLabels([box("a", 0, 0), box("b", 100, 0)], 200, 50, 4);
    assert.deepEqual([...kept], ["a", "b"]);
  });

  it("keeps the earlier label when two overlap", () => {
    const kept = placeLabels([box("a", 10, 10), box("b", 30, 14)], 200, 50, 4);
    assert.deepEqual([...kept], ["a"]);
  });

  it("treats labels closer than the gap as overlapping", () => {
    const kept = placeLabels([box("a", 0, 0), box("b", 43, 0)], 200, 50, 4);
    assert.deepEqual([...kept], ["a"]);
  });

  it("lets a later label in when an earlier one was dropped", () => {
    const kept = placeLabels(
      [box("a", 0, 0), box("b", 20, 0), box("c", 50, 0)],
      200,
      50,
      4
    );
    assert.deepEqual([...kept], ["a", "c"]);
  });

  it("drops labels that leave the viewport", () => {
    const kept = placeLabels(
      [box("left", -1, 0), box("right", 170, 0), box("low", 0, 45)],
      200,
      50,
      4
    );
    assert.deepEqual([...kept], []);
  });
});
