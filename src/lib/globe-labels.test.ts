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

const cluster = Array.from({ length: 10 }, (_, index) =>
  anchor(`c${String(index)}`, 100 + (index % 4), 50 + (index % 3))
);

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
      cluster.map((spot) => spot.key)
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

  it("uses a corner when all four sides are taken", () => {
    const sideBlocks = [
      anchor("r", 226, 50),
      anchor("l", 174, 50),
      anchor("a", 200, 39),
      anchor("b", 200, 61),
    ];
    const corners: Array<{
      dot: [number, number];
      side: LabelSide;
      spot: [number, number];
    }> = [
      { dot: [223.6, 41.4], side: "aboveRight", spot: [203.6, 36.4] },
      { dot: [223.6, 58.6], side: "belowRight", spot: [203.6, 53.6] },
      { dot: [176.4, 41.4], side: "aboveLeft", spot: [156.4, 36.4] },
      { dot: [176.4, 58.6], side: "belowLeft", spot: [156.4, 53.6] },
    ];
    for (const corner of corners) {
      const cornerBlocks = corners
        .filter((other) => other.side !== corner.side)
        .map((other) => anchor(other.side, ...other.dot));
      const [spot] = placeLabels(
        [anchor("t", 200, 50), ...sideBlocks, ...cornerBlocks],
        400,
        100,
        4
      );
      const [x, y] = corner.spot;
      assert.equal(spot?.side, corner.side);
      assert.ok(spot && Math.abs(spot.x - x) < 1e-9, `${corner.side} x`);
      assert.ok(spot && Math.abs(spot.y - y) < 1e-9, `${corner.side} y`);
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
    const tight = [anchor("s", 20, 8)];
    const fresh = placeLabels(tight, 40, 10, 4);
    const sticky = placeLabels(tight, 40, 10, 4, new Map([["s", "below"]]));
    const far = placeLabels(tight, 40, 10, 4, new Map([["s", "right"]]));
    assert.equal(sideOf(fresh, "s"), "above");
    assert.equal(sideOf(sticky, "s"), "below");
    assert.equal(sideOf(far, "s"), "above");
  });

  it("keeps labels off blocked areas when another spot is free", () => {
    const placed = placeLabels([anchor("a", 100, 50)], 300, 100, 4, new Map(), [
      { height: 20, width: 60, x: 100, y: 40 },
    ]);
    assert.equal(sideOf(placed, "a"), "left");
  });

  it("slides a label clear of a blocked area that covers its dot", () => {
    const [spot] = placeLabels([anchor("k", 262, 80)], 300, 100, 4, new Map(), [
      { height: 60, width: 50, x: 250, y: 40 },
    ]);
    assert.deepEqual(spot, { key: "k", side: "left", x: 206, y: 75 });
  });

  it("still places a label when every spot is blocked", () => {
    const placed = placeLabels([anchor("a", 100, 50)], 300, 100, 4, new Map(), [
      { height: 100, width: 300, x: 0, y: 0 },
    ]);
    assert.deepEqual(placed, [{ key: "a", side: "right", x: 106, y: 45 }]);
  });

  it("is deterministic", () => {
    assert.deepEqual(
      placeLabels(cluster, 300, 100, 4),
      placeLabels(cluster, 300, 100, 4)
    );
  });
});
