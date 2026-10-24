import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { luminance } from "./sky-ink.ts";
import {
  lutCols,
  lutRows,
  mixSkyTable,
  safeSkyTable,
  type ScatterOutput,
  scatterSky,
  type SkyTable,
  skyTable,
  type TableInput,
  warmSkyTable,
} from "./sky-light.ts";
import { paintPalettes } from "./sky-palette.ts";
import { hexBytes } from "./theme.ts";

type Bytes = [number, number, number];

const unit = (hex: string): Bytes => {
  const [r, g, b] = hexBytes(hex);
  return [r / 255, g / 255, b / 255];
};

const { night } = paintPalettes;

const gridCols = 72;
const gridRows = 44;

const frame = (altitude: number): ScatterOutput =>
  scatterSky({
    adapt: 0.28,
    blueHour: 1,
    cols: gridCols,
    haze: 1.2,
    moon: { altitude: -30, azimuth: 0, power: 0 },
    multi: 0.6,
    night: { low: unit(night.low), mid: unit(night.mid), top: unit(night.top) },
    rows: gridRows,
    sun: { altitude, azimuth: 255, power: 1 },
    view: { center: 255, height: 900, horizon: 18, ppd: 9.8, width: 1440 },
  });

const pixelAt = (f: ScatterOutput, row: number, col: number): Bytes => {
  const i = (row * gridCols + col) * 4;
  return [f.pixels[i] ?? 0, f.pixels[i + 1] ?? 0, f.pixels[i + 2] ?? 0];
};

const at = (f: ScatterOutput, yb: number): Bytes =>
  pixelAt(f, Math.floor(yb * gridRows), Math.floor(0.5 * gridCols));

const pixelsAbove = (f: ScatterOutput, share: number): Bytes[] => {
  const found: Bytes[] = [];
  for (let row = 0; row < gridRows; row++)
    if ((row + 0.5) / gridRows >= share)
      for (let col = 0; col < gridCols; col++) found.push(pixelAt(f, row, col));
  return found;
};

const near = (actual: Bytes, expected: Bytes): void => {
  for (let i = 0; i < 3; i++)
    assert.ok(
      Math.abs((actual[i] ?? 0) - (expected[i] ?? 0)) <= 6,
      `${actual.join(",")} is not near ${expected.join(",")}`
    );
};

const tableInput: TableInput = {
  center: 255,
  haze: 1,
  moon: { altitude: 20, azimuth: 120, fraction: 0.5 },
  sun: { altitude: 6, azimuth: 255 },
  view: { height: 900, width: 1440 },
};

const colorChannels = (table: SkyTable): number[] => [
  ...table.lit,
  ...table.low,
  ...table.mid,
  ...table.shade,
  ...table.sunColor,
  ...table.top,
];

describe("sky light", () => {
  it("paints a blue sky over a golden horizon at +6 degrees", () => {
    const f = frame(6);
    const [mr, , mb] = at(f, 0.45);
    assert.ok(mb > mr + 40);
    const [lr, , lb] = at(f, 0.03);
    assert.ok(lr > lb + 60);
  });

  it("turns violet over a red band at -3 degrees", () => {
    const f = frame(-3);
    const [r, g, b] = at(f, 0.45);
    assert.ok(b > r && b > g);
    const [lr, lg, lb] = at(f, 0.03);
    assert.ok(lr > lg && lg > lb);
  });

  it("has no yellow above 10% of the height at -3 degrees", () => {
    const upper = pixelsAbove(frame(-3), 0.1);
    for (const [r, g, b] of upper)
      assert.ok(!(r > 120 && g > 0.75 * r && b < 0.7 * g));
  });

  it("is deep navy at -8 degrees", () => {
    for (const yb of [0.45, 0.9]) {
      const [r, g, b] = at(frame(-8), yb);
      assert.ok(b > r && b > g && luminance(r, g, b) < 0.03);
    }
  });

  it("matches the prototype reference colors", () => {
    near(at(frame(6), 0.45), [125, 155, 195]);
    near(at(frame(6), 0.03), [255, 203, 150]);
    near(at(frame(-3), 0.45), [99, 90, 130]);
    near(at(frame(-3), 0.03), [255, 163, 116]);
    near(at(frame(-8), 0.45), [36, 38, 63]);
    near(at(frame(-8), 0.9), [24, 27, 44]);
  });

  it("builds a 40 by 24 table with colors in range", () => {
    const table = skyTable(tableInput);
    assert.equal(table.pixels.length, lutCols * lutRows * 4);
    for (const color of [
      table.lit,
      table.low,
      table.mid,
      table.shade,
      table.sunColor,
      table.top,
    ])
      for (const channel of color) {
        assert.ok(Number.isFinite(channel));
        assert.ok(channel >= 0 && channel <= 1);
      }
  });

  it("derives the row means from the table pixels", () => {
    const table = skyTable(tableInput);
    const row = Math.floor(0.45 * lutRows);
    let red = 0;
    for (let col = 0; col < lutCols; col++)
      red += (table.pixels[(row * lutCols + col) * 4] ?? 0) / 255;
    assert.ok(Math.abs(table.mid[0] - red / lutCols) < 1e-9);
  });

  it("returns to the same pixels when the haze returns", () => {
    const first = skyTable({ ...tableInput, haze: 1 });
    const second = skyTable({ ...tableInput, haze: 2 });
    const third = skyTable({ ...tableInput, haze: 1 });
    assert.deepEqual(third.pixels, first.pixels);
    assert.notDeepEqual(second.pixels, first.pixels);
  });

  it("treats a NaN haze as haze 1", () => {
    const base = skyTable({ ...tableInput, haze: 1 });
    const table = skyTable({ ...tableInput, haze: NaN });
    assert.deepEqual(table.pixels, base.pixels);
    for (const channel of colorChannels(table)) {
      assert.ok(Number.isFinite(channel));
      assert.ok(channel >= 0 && channel <= 1);
    }
  });

  it("keeps colors finite and in range with no haze", () => {
    const table = skyTable({ ...tableInput, haze: 0 });
    for (const channel of colorChannels(table)) {
      assert.ok(Number.isFinite(channel));
      assert.ok(channel >= 0 && channel <= 1);
    }
  });

  it("keeps the night table finite with the moon below the horizon", () => {
    const table = skyTable({
      ...tableInput,
      moon: { altitude: -40, azimuth: 0, fraction: 0 },
      sun: { altitude: -30, azimuth: 0 },
    });
    for (const value of table.pixels) assert.ok(Number.isFinite(value));
    for (const channel of [...table.lit, ...table.shade, ...table.sunColor])
      assert.ok(Number.isFinite(channel));
  });
});

describe("warmSkyTable", () => {
  it("fills the caches and leaves the table unchanged", () => {
    const before = skyTable(tableInput);
    warmSkyTable();
    assert.deepEqual(skyTable(tableInput).pixels, before.pixels);
  });
});

describe("mixSkyTable", () => {
  const dawn = skyTable(tableInput);
  const noon = skyTable({
    ...tableInput,
    sun: { altitude: 40, azimuth: 180 },
  });

  it("returns the first table at 0 and the second at 1", () => {
    assert.deepEqual(mixSkyTable(dawn, noon, 0), dawn);
    assert.deepEqual(mixSkyTable(dawn, noon, 1), noon);
  });

  it("clamps the share to 0..1", () => {
    assert.deepEqual(mixSkyTable(dawn, noon, -3), dawn);
    assert.deepEqual(mixSkyTable(dawn, noon, 7), noon);
  });

  it("lands between the tables at one half", () => {
    const half = mixSkyTable(dawn, noon, 0.5);
    for (let i = 0; i < half.pixels.length; i++) {
      const a = dawn.pixels[i] ?? 0;
      const b = noon.pixels[i] ?? 0;
      assert.ok(Math.abs((half.pixels[i] ?? 0) - (a + b) / 2) <= 0.5);
    }
    assert.ok(Math.abs(half.top[0] - (dawn.top[0] + noon.top[0]) / 2) < 1e-12);
  });

  it("writes into the given table without allocating a new buffer", () => {
    const into = skyTable(tableInput);
    const { pixels } = into;
    const out = mixSkyTable(dawn, noon, 1, into);
    assert.equal(out.pixels, pixels);
    assert.deepEqual(out.pixels, noon.pixels);
  });
});

describe("safeSkyTable", () => {
  it("returns a table for a normal input", () => {
    const table = safeSkyTable(tableInput);
    assert.ok(table);
    assert.equal(table.pixels.length, lutCols * lutRows * 4);
  });

  it("returns undefined when a color is not finite", () => {
    assert.equal(
      safeSkyTable({
        ...tableInput,
        sun: { altitude: NaN, azimuth: 0 },
      }),
      undefined
    );
  });

  it("returns undefined when the build throws", () => {
    const broken = { ...tableInput, view: undefined } as unknown as TableInput;
    assert.equal(safeSkyTable(broken), undefined);
  });
});
