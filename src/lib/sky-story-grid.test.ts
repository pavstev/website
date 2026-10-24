import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type SkyTable, skyTable, type TableInput } from "./sky-light.ts";
import {
  createTableGrid,
  gridChapter,
  gridChapters,
  gridCount,
  gridKeeps,
  gridPerChapter,
} from "./sky-story-grid.ts";

const input = (altitude: number): TableInput => ({
  center: 255,
  haze: 1,
  moon: { altitude: -30, azimuth: 0, fraction: 0.5 },
  sun: { altitude, azimuth: 255 },
  view: { height: 900, width: 1440 },
});

const low: SkyTable = skyTable(input(2));
const high: SkyTable = skyTable(input(30));

describe("grid points", () => {
  it("spans eight chapters with twelve points each", () => {
    assert.equal(gridCount, gridChapters * gridPerChapter + 1);
    assert.equal(gridChapter(0), 0);
    assert.equal(gridChapter(gridCount - 1), gridChapters);
    assert.equal(gridChapter(gridPerChapter * 3), 3);
  });
});

describe("createTableGrid", () => {
  it("has nothing to give while empty", () => {
    const grid = createTableGrid();
    assert.equal(grid.at(2.5), undefined);
    assert.equal(grid.filled(), 0);
  });

  it("gives the exact table on a grid point", () => {
    const grid = createTableGrid();
    grid.put(12, low);
    grid.put(13, high);
    assert.deepEqual(grid.at(1), low);
  });

  it("blends the two nearest points at their end points and between", () => {
    const grid = createTableGrid();
    grid.put(12, low);
    grid.put(13, high);
    assert.deepEqual(grid.at(1 + 1 / gridPerChapter), high);
    const half = grid.at(1 + 0.5 / gridPerChapter);
    assert.ok(half);
    const mid = ((low.pixels[2] ?? 0) + (high.pixels[2] ?? 0)) / 2;
    assert.ok(Math.abs((half.pixels[2] ?? 0) - mid) <= 0.5);
  });

  it("reuses one buffer for every blend", () => {
    const grid = createTableGrid();
    grid.put(12, low);
    grid.put(13, high);
    const first = grid.at(1.02);
    const second = grid.at(1.05);
    assert.equal(first?.pixels, second?.pixels);
  });

  it("falls back to the one point it has", () => {
    const grid = createTableGrid();
    grid.put(13, high);
    assert.equal(grid.at(1.04), high);
    assert.equal(grid.at(1 + 1 / gridPerChapter), high);
  });

  it("clamps the chapter to the first and the last point", () => {
    const grid = createTableGrid();
    grid.put(0, low);
    grid.put(gridCount - 1, high);
    assert.equal(grid.at(-4), low);
    assert.equal(grid.at(20), high);
  });

  it("asks for the nearest missing point first", () => {
    const grid = createTableGrid();
    assert.equal(grid.next(0), 0);
    assert.equal(grid.next(2), 24);
    grid.put(24, low);
    assert.equal(grid.next(2), 23);
    grid.put(23, low);
    assert.equal(grid.next(2), 25);
  });

  it("skips a failed point and ends when all are placed", () => {
    const grid = createTableGrid();
    grid.skip(0);
    assert.equal(grid.next(0), 1);
    assert.equal(grid.at(0.02), undefined);
    for (let index = 0; index < gridCount; index += 1) grid.put(index, low);
    assert.equal(grid.next(4), undefined);
    assert.equal(grid.filled(), gridCount);
  });

  it("empties on reset", () => {
    const grid = createTableGrid();
    grid.put(12, low);
    grid.reset();
    assert.equal(grid.filled(), 0);
    assert.equal(grid.at(1), undefined);
  });
});

describe("gridKeeps", () => {
  const built = { height: 800, width: 400 };
  it("keeps the grid for a small height change", () => {
    assert.equal(gridKeeps(built, { height: 800, width: 400 }), true);
    assert.equal(gridKeeps(built, { height: 900, width: 400 }), true);
    assert.equal(gridKeeps(built, { height: 690, width: 400 }), true);
  });
  it("drops the grid for a width change or a height change over 15%", () => {
    assert.equal(gridKeeps(built, { height: 800, width: 401 }), false);
    assert.equal(gridKeeps(built, { height: 930, width: 400 }), false);
    assert.equal(gridKeeps(built, { height: 670, width: 400 }), false);
  });
});
