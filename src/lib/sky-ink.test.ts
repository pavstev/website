import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contrast,
  inkMargin,
  inkTargets,
  liftedLuminance,
  liftFor,
  luminance,
  nextLift,
  skyLevel,
  tintLuminance,
} from "./sky-ink.ts";
import { inkPalette } from "./theme.ts";

describe("luminance", () => {
  it("follows the WCAG relative luminance", () => {
    assert.equal(luminance(0, 0, 0), 0);
    assert.equal(luminance(255, 255, 255), 1);
    assert.ok(Math.abs(luminance(119, 119, 119) - 0.184) < 0.001);
  });

  it("gives white on black a ratio of 21", () => {
    assert.equal(contrast(1, 0), 21);
    assert.equal(contrast(0, 1), 21);
  });
});

describe("liftedLuminance", () => {
  it("runs from the base color to white", () => {
    const [red, green, blue] = [0xc3, 0xc7, 0xd6];
    assert.equal(
      liftedLuminance(inkPalette.soft, 0),
      luminance(red, green, blue)
    );
    assert.equal(liftedLuminance(inkPalette.soft, 1), 1);
    assert.ok(
      liftedLuminance(inkPalette.soft, 0.5) >
        liftedLuminance(inkPalette.soft, 0)
    );
  });
});

describe("liftFor", () => {
  it("keeps the base color on a dark sky", () => {
    assert.equal(liftFor(inkPalette.soft, 0.01, 4.5), 0);
  });

  it("lifts just enough to clear the target with the margin", () => {
    const sky = 0.09;
    const lift = liftFor(inkPalette.soft, sky, 4.5);
    assert.ok(lift > 0 && lift < 1);
    assert.ok(
      contrast(liftedLuminance(inkPalette.soft, lift), sky) >= 4.5 * inkMargin
    );
    assert.ok(
      contrast(liftedLuminance(inkPalette.soft, lift - 0.05), sky) <
        4.5 * inkMargin
    );
  });

  it("goes to white when nothing else clears the target", () => {
    assert.equal(liftFor(inkPalette.muted, 0.5, 4.5), 1);
  });
});

describe("skyLevel", () => {
  it("reads one slot of the probe and adds the page tint", () => {
    const columns = 4;
    const rows = 2;
    const slots = 2;
    const pixels = new Uint8Array(columns * slots * rows * 4);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const at = (row * columns * slots + columns + column) * 4;
        pixels.set([255, 255, 255, 255], at);
      }
    }
    const block = { columns, rows, stride: columns * slots };
    assert.equal(skyLevel(pixels, { ...block, slot: 0 }), tintLuminance);
    assert.equal(skyLevel(pixels, { ...block, slot: 1 }), 1 + tintLuminance);
  });

  it("ignores a single bright sample such as a star", () => {
    const columns = 24;
    const rows = 6;
    const pixels = new Uint8Array(columns * rows * 4);
    pixels.set([255, 255, 255, 255], 0);
    assert.equal(
      skyLevel(pixels, { columns, rows, slot: 0, stride: columns }),
      tintLuminance
    );
  });
});

describe("nextLift", () => {
  it("raises at once and lowers only past a dead band", () => {
    assert.equal(nextLift(0.2, 0.5), 0.5);
    assert.equal(nextLift(0.5, 0.45), 0.5);
    assert.equal(nextLift(0.5, 0.3), 0.3);
  });
});

describe("inkTargets", () => {
  it("lists every text that sits on the sky with its target", () => {
    assert.deepEqual(
      inkTargets.map((target) => target.need),
      [3, 6.9, 4.5, 4.5, 4.5, 4.5]
    );
  });
});
