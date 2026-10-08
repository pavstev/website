import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type LabelAnchor,
  type LabelSide,
  type PlacedLabel,
  placeLabels,
} from "./globe-labels.ts";

const anchor = (key: string, x: number, y: number): LabelAnchor => ({
  height: 10,
  key,
  offset: 6,
  radius: 3,
  width: 40,
  x,
  y,
});

const sideOf = (placed: readonly PlacedLabel[], key: string): LabelSide => {
  const label = placed.find((spot) => spot.key === key);
  if (!label) throw new Error(`no label for ${key}`);
  return label.side;
};

const boxesOverlap = (a: PlacedLabel, b: PlacedLabel): boolean =>
  a.x < b.x + 40 && b.x < a.x + 40 && a.y < b.y + 10 && b.y < a.y + 10;

const cluster = [
  anchor("a", 100, 50),
  anchor("b", 102, 50),
  anchor("c", 104, 52),
  anchor("d", 100, 54),
  anchor("e", 98, 49),
];

describe("placeLabels", () => {
  it("puts a label right of its dot when that side is free", () => {
    assert.deepEqual(placeLabels([anchor("a", 100, 50)], 300, 100, 4), [
      { key: "a", side: "right", x: 106, y: 45 },
    ]);
  });

  it("places every label in input order, even when they cannot all be free", () => {
    const placed = placeLabels(cluster, 300, 100, 4);
    assert.deepEqual(
      placed.map((spot) => spot.key),
      ["a", "b", "c", "d", "e"]
    );
    const crowded = placed.some((spot, index) =>
      placed.slice(index + 1).some((other) => boxesOverlap(spot, other))
    );
    assert.ok(crowded);
  });

  it("gives the first label its side before later ones", () => {
    const placed = placeLabels(
      [anchor("home", 100, 50), anchor("city", 100, 50)],
      300,
      100,
      4
    );
    assert.equal(sideOf(placed, "home"), "right");
    assert.equal(sideOf(placed, "city"), "left");
  });

  it("moves a label to a free side when its right side is taken", () => {
    const placed = placeLabels(
      [anchor("a", 100, 50), anchor("b", 100, 62)],
      300,
      100,
      4
    );
    assert.deepEqual(placed[1], { key: "b", side: "left", x: 54, y: 57 });
  });

  it("treats labels closer than the gap as overlapping", () => {
    const cases: Array<[number, number, LabelSide]> = [
      [100, 63, "left"],
      [100, 65, "right"],
      [100, 37, "left"],
      [100, 35, "right"],
      [57, 42, "left"],
      [54, 42, "right"],
      [143, 42, "above"],
      [146, 42, "right"],
    ];
    for (const [x, y, side] of cases) {
      const placed = placeLabels(
        [anchor("a", 100, 50), anchor("b", x, y)],
        300,
        100,
        4
      );
      assert.equal(sideOf(placed, "b"), side, `b at ${String(x)},${String(y)}`);
    }
  });

  it("prefers a side inside the view over one that has to be clamped", () => {
    assert.deepEqual(placeLabels([anchor("a", 280, 50)], 300, 100, 4), [
      { key: "a", side: "left", x: 234, y: 45 },
    ]);
  });

  it("clamps labels into the view instead of dropping them", () => {
    const placed = placeLabels(
      [
        anchor("middle", 30, 12),
        anchor("corner", 2, 2),
        anchor("edge", 58, 22),
      ],
      60,
      24,
      4
    );
    assert.equal(placed.length, 3);
    for (const spot of placed) {
      assert.ok(
        spot.x >= 0 && spot.x + 40 <= 60,
        `${spot.key} x ${String(spot.x)}`
      );
      assert.ok(
        spot.y >= 0 && spot.y + 10 <= 24,
        `${spot.key} y ${String(spot.y)}`
      );
    }
  });

  it("keeps the previous side between frames while it stays free", () => {
    const left = placeLabels(
      [anchor("a", 100, 50)],
      300,
      100,
      4,
      new Map([["a", "left"]])
    );
    const below = placeLabels(
      [anchor("a", 100, 50)],
      300,
      100,
      4,
      new Map([["a", "below"]])
    );
    assert.deepEqual(left, [{ key: "a", side: "left", x: 54, y: 45 }]);
    assert.deepEqual(below, [{ key: "a", side: "below", x: 80, y: 56 }]);
  });

  it("leaves the previous side when another side is clearly freer", () => {
    const placed = placeLabels(
      [anchor("a", 100, 50), anchor("b", 100, 62)],
      300,
      100,
      4,
      new Map([["b", "right"]])
    );
    assert.equal(sideOf(placed, "b"), "left");
  });

  it("keeps the previous side when another side is only slightly freer", () => {
    const crowd = [
      anchor("a", 100, 50),
      anchor("b", 100, 62),
      anchor("d1", 60, 62),
      anchor("d2", 70, 62),
    ];
    const fresh = placeLabels(crowd, 300, 70, 4);
    const sticky = placeLabels(crowd, 300, 70, 4, new Map([["b", "right"]]));
    assert.equal(sideOf(fresh, "b"), "left");
    assert.equal(sideOf(sticky, "b"), "right");
  });

  it("is deterministic", () => {
    assert.deepEqual(
      placeLabels(cluster, 300, 100, 4),
      placeLabels(cluster, 300, 100, 4)
    );
  });
});
