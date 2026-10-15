import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Box, placeTip } from "./tip-place.ts";

const viewport = { height: 800, width: 1000 };

const box = (
  left: number,
  top: number,
  width: number,
  height: number
): Box => ({
  bottom: top + height,
  left,
  right: left + width,
  top,
});

describe("placeTip", () => {
  it("keeps a tip that fits on the preferred side", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.deepEqual(result, { gap: 7, shift: 0, side: "top" });
  });

  it("closes the gap to the minimum to keep 8 px clear of text above", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [{ box: box(0, 340, 1000, 25), weight: 1 }],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.deepEqual(result, { gap: 3, shift: 0, side: "top" });
  });

  it("keeps the full gap while the clear space allows it", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [{ box: box(0, 300, 1000, 25), weight: 1 }],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.deepEqual(result, { gap: 7, shift: 0, side: "top" });
  });

  it("uses a gap in between when the clear space is part way", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [{ box: box(0, 332, 1000, 30), weight: 1 }],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.deepEqual(result, { gap: 6, shift: 0, side: "top" });
  });

  it("flips below when there is no room above", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 4, 44, 44),
      avoid: [],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.equal(result.side, "bottom");
  });

  it("flips above when a bottom tip has no room below", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 750, 44, 44),
      avoid: [],
      height: 40,
      side: "bottom",
      viewport,
      width: 100,
    });
    assert.equal(result.side, "top");
  });

  it("slides a tip back from the left edge", () => {
    const result = placeTip({
      align: "center",
      anchor: box(0, 400, 44, 44),
      avoid: [],
      height: 24,
      side: "top",
      viewport,
      width: 200,
    });
    assert.equal(result.shift, 8 - (22 - 100));
  });

  it("slides a tip back from the right edge", () => {
    const result = placeTip({
      align: "end",
      anchor: box(980, 20, 44, 44),
      avoid: [],
      height: 24,
      side: "bottom",
      viewport,
      width: 100,
    });
    assert.equal(result.shift, 1000 - 8 - 1024);
  });

  it("slides sideways to clear a heavy blocker when it can", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [
        { box: box(450, 360, 20, 20), weight: 2 },
        { box: box(0, 455, 1000, 25), weight: 2 },
      ],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.deepEqual(result, { gap: 7, shift: 26, side: "top" });
  });

  it("covers a light blocker rather than a heavy one", () => {
    const result = placeTip({
      align: "center",
      anchor: box(480, 400, 44, 44),
      avoid: [
        { box: box(0, 340, 1000, 40), weight: 1 },
        { box: box(0, 450, 1000, 40), weight: 2 },
      ],
      height: 24,
      side: "top",
      viewport,
      width: 100,
    });
    assert.equal(result.side, "top");
  });
});
