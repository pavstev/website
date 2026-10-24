import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { layerPixels, patchRect, watchContextLoss } from "./moon-layer.ts";

describe("watchContextLoss", () => {
  it("keeps the browser from restoring and calls onLost once per loss", () => {
    const target = new EventTarget();
    let calls = 0;
    watchContextLoss(target, () => {
      calls += 1;
    });
    const event = new Event("webglcontextlost", { cancelable: true });
    target.dispatchEvent(event);
    assert.equal(calls, 1);
    assert.equal(event.defaultPrevented, true);
  });

  it("stops calling after the returned remover runs", () => {
    const target = new EventTarget();
    let calls = 0;
    const remove = watchContextLoss(target, () => {
      calls += 1;
    });
    remove();
    target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    assert.equal(calls, 0);
  });
});

describe("patchRect", () => {
  it("reads a 32 px patch on a 900 px screen", () =>
    assert.equal(
      patchRect(
        { radius: 42.3, x: 1000, y: 700 },
        { height: 338, width: 540 },
        0.375
      ).size,
      32
    ));

  it("caps the patch at 64 px", () =>
    assert.equal(
      patchRect(
        { radius: 200, x: 500, y: 500 },
        { height: 600, width: 1000 },
        0.375
      ).size,
      64
    ));

  it("keeps the patch inside the texture", () => {
    const rect = patchRect(
      { radius: 42.3, x: 5, y: 700 },
      { height: 338, width: 540 },
      0.375
    );
    assert.equal(rect.x, 0);
    const high = patchRect(
      { radius: 42.3, x: 1000, y: 2000 },
      { height: 338, width: 540 },
      0.375
    );
    assert.equal(high.y, 338 - high.size);
  });

  it("centers the patch on the moon", () => {
    const rect = patchRect(
      { radius: 42.3, x: 800, y: 400 },
      { height: 450, width: 720 },
      0.375
    );
    assert.deepEqual([rect.x, rect.y], [300 - 16, 150 - 16]);
  });
});

describe("layerPixels", () => {
  it("caps the layer at 2x density", () =>
    assert.deepEqual(layerPixels(42.3, 3), { css: 94, device: 188 }));

  it("keeps one device pixel per css pixel at density 1", () =>
    assert.deepEqual(layerPixels(42.3, 1), { css: 94, device: 94 }));
});
