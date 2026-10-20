import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bayerThreshold,
  cellCssPx,
  cellInCircle,
  haloAlpha,
  haloBandShare,
  haloFalloff,
  haloLit,
  haloPulse,
  lensRadiusShare,
  lensRing,
  lumaOf,
  outlineHit,
  pickTone,
  rimCells,
  toneIndex,
} from "./portrait-dither.ts";
import { ditherTones } from "./theme.ts";

describe("bayerThreshold", () => {
  it("uses every one of the 16 levels once per 4 x 4 block", () => {
    const seen = new Set<number>();
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) seen.add(bayerThreshold(gx, gy));
    }
    assert.equal(seen.size, 16);
    assert.equal(Math.min(...seen), 0.5 / 16);
    assert.equal(Math.max(...seen), 15.5 / 16);
  });

  it("repeats every 4 cells, negative cells included", () => {
    assert.equal(bayerThreshold(5, 6), bayerThreshold(1, 2));
    assert.equal(bayerThreshold(-1, -1), bayerThreshold(3, 3));
  });
});

describe("toneIndex and pickTone", () => {
  it("maps black and white to the end tones at any threshold", () => {
    for (const threshold of [0.03, 0.5, 0.97]) {
      assert.equal(toneIndex(0, threshold), 0);
      assert.equal(toneIndex(1, threshold), 3);
    }
  });

  it("lets the threshold tip a mid grey between two tones", () => {
    assert.equal(toneIndex(0.5, 0.03), 1);
    assert.equal(toneIndex(0.5, 0.97), 2);
  });

  it("never goes down when the luminance goes up", () => {
    for (const threshold of [0.03, 0.4, 0.8]) {
      let last = 0;
      for (let step = 0; step <= 20; step++) {
        const index = toneIndex(step / 20, threshold);
        assert.ok(index >= last);
        last = index;
      }
    }
  });

  it("returns a tone token", () => {
    assert.equal(pickTone(0, 0.5), ditherTones[0]);
    assert.equal(pickTone(1, 0.5), ditherTones[3]);
  });
});

describe("lumaOf", () => {
  it("is 0 for black, 1 for white and weighs green most", () => {
    assert.equal(lumaOf(0, 0, 0), 0);
    assert.ok(Math.abs(lumaOf(255, 255, 255) - 1) < 1e-9);
    assert.ok(lumaOf(0, 255, 0) > lumaOf(255, 0, 0));
    assert.ok(lumaOf(255, 0, 0) > lumaOf(0, 0, 255));
  });
});

describe("cellInCircle", () => {
  it("keeps a cell when its center is inside or on the circle", () => {
    assert.equal(cellInCircle(10, 10, 10, 10, 46), true);
    assert.equal(cellInCircle(56, 10, 10, 10, 46), true);
  });

  it("drops a cell whose center is outside", () => {
    assert.equal(cellInCircle(56.5, 10, 10, 10, 46), false);
    assert.equal(cellInCircle(40, 40, 10, 10, 46), true);
    assert.equal(cellInCircle(50, 50, 10, 10, 46), false);
  });

  it("sizes the lens at 0.6 of the photo radius, about 46 px on the 154 px portrait", () => {
    assert.equal(lensRadiusShare, 0.6);
    assert.ok(Math.abs(lensRadiusShare * 77 - 46) < 0.5);
  });
});

describe("halo", () => {
  it("falls off from 1 at the photo edge to 0 at the band edge", () => {
    assert.equal(haloFalloff(77, 77, 17), 1);
    assert.equal(haloFalloff(94, 77, 17), 0);
    assert.ok(Math.abs(haloFalloff(85.5, 77, 17) - 0.5) < 1e-9);
  });

  it("has no light inside the photo or beyond the band", () => {
    assert.equal(haloFalloff(70, 77, 17), 0);
    assert.equal(haloFalloff(100, 77, 17), 0);
  });

  it("pulses between 0.7 and 1", () => {
    for (let step = 0; step < 200; step++) {
      const pulse = haloPulse(step * 0.1, step);
      assert.ok(pulse >= 0.7 - 1e-9 && pulse <= 1 + 1e-9);
    }
  });

  it("lights a cell when falloff times pulse beats the Bayer threshold", () => {
    assert.equal(haloLit(0.9, 1, 0.5), true);
    assert.equal(haloLit(0.4, 1, 0.5), false);
    assert.equal(haloLit(0.5, 0.85, 0.45), false);
    assert.equal(haloLit(0.55, 0.85, 0.45), true);
    assert.equal(haloLit(0, 1, 0), false);
  });

  it("runs the alpha from 0.35 at the band edge to 0.85 at the photo", () => {
    assert.equal(haloAlpha(0), 0.35);
    assert.equal(haloAlpha(1), 0.85);
  });
});

describe("pixel outline", () => {
  it("uses 2 px cells and a halo about 10 px wide on the 154 px photo", () => {
    assert.equal(cellCssPx, 2);
    assert.ok(Math.abs(haloBandShare * 77 - 10) < 0.5);
  });

  it("lights one cell ring on the photo edge", () => {
    assert.equal(outlineHit(99, 100, 2), true);
    assert.equal(outlineHit(100.9, 100, 2), true);
    assert.equal(outlineHit(101, 100, 2), false);
    assert.equal(outlineHit(98.9, 100, 2), false);
  });

  it("rings the lens with an outline, then a dithered halo", () => {
    assert.equal(lensRing(40, 40, 2, 0.5), undefined);
    assert.equal(lensRing(41, 40, 2, 0.5), "outline");
    assert.equal(lensRing(43, 40, 2, 0.5), "halo");
    assert.equal(lensRing(45.9, 40, 2, 0.5), undefined);
    assert.equal(lensRing(47, 40, 2, 0), undefined);
  });
});

describe("rimCells", () => {
  it("frames a 240 px photo with an outline on its edge and a halo outside", () => {
    const cells = rimCells(240, 1, 1);
    assert.equal(cells.margin, 21);
    assert.equal(cells.side, 282);
    assert.ok(cells.edgeX.length > 0 && cells.x.length > 0);
    const center = cells.side / 2;
    const half = cellCssPx / 2;
    for (const [index, x] of cells.edgeX.entries()) {
      const distance = Math.hypot(
        x + half - center,
        (cells.edgeY[index] ?? 0) + half - center
      );
      assert.ok(Math.abs(distance - 120) <= half);
    }
    for (const [index, x] of cells.x.entries()) {
      const distance = Math.hypot(
        x + half - center,
        (cells.y[index] ?? 0) + half - center
      );
      assert.ok(distance > 120 && distance <= 120 + haloBandShare * 120 + half);
    }
  });
});
